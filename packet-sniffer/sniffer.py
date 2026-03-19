from scapy.all import *

def packet_callback(packet):
    if packet.haslayer(IP):
        ip_layer = packet[IP]
        print("\n[+] New Packet")

        print("Source IP:", ip_layer.src)
        print("Destination IP:", ip_layer.dst)
        print("Protocol:", ip_layer.proto)

        # TCP
        if packet.haslayer(TCP):
            print("Protocol: TCP")
            print("Source Port:", packet[TCP].sport)
            print("Destination Port:", packet[TCP].dport)

        # UDP
        elif packet.haslayer(UDP):
            print("Protocol: UDP")
            print("Source Port:", packet[UDP].sport)
            print("Destination Port:", packet[UDP].dport)

        # ICMP
        elif packet.haslayer(ICMP):
            print("Protocol: ICMP")

# Start sniffing
print("Sniffing started...")

sniff(prn=packet_callback, store=False)