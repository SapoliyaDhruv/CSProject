import tkinter as tk
from tkinter import ttk
from scapy.all import sniff, IP, TCP, UDP
import threading
import socket

sniffing = False

# 🔍 Get domain from IP
def get_domain(ip):
    try:
        return socket.gethostbyaddr(ip)[0]
    except:
        return "Unknown"

# Packet processing
def process_packet(packet):
    if packet.haslayer(IP):
        src = packet[IP].src
        dst = packet[IP].dst

        # 🌐 Get domain (DESTINATION is more useful)
        domain = get_domain(dst)

        proto = ""
        sport = "-"
        dport = "-"

        if packet.haslayer(TCP):
            proto = "TCP"
            sport = packet[TCP].sport
            dport = packet[TCP].dport
        elif packet.haslayer(UDP):
            proto = "UDP"
            sport = packet[UDP].sport
            dport = packet[UDP].dport
        else:
            proto = "Other"

        # Insert into GUI table
        tree.insert("", "end", values=(src, dst, domain, proto, sport, dport))


# Sniffing thread
def start_sniffing():
    global sniffing
    sniffing = True

    def sniff_packets():
        sniff(prn=process_packet, store=False, stop_filter=lambda x: not sniffing)

    threading.Thread(target=sniff_packets, daemon=True).start()


def stop_sniffing():
    global sniffing
    sniffing = False


# GUI
root = tk.Tk()
root.title("Advanced Packet Sniffer (With Domain Detection)")
root.geometry("850x450")

columns = ("Source IP", "Destination IP", "Domain", "Protocol", "Src Port", "Dst Port")
tree = ttk.Treeview(root, columns=columns, show="headings")

for col in columns:
    tree.heading(col, text=col)
    tree.column(col, width=130)

tree.pack(fill=tk.BOTH, expand=True)

# Buttons
frame = tk.Frame(root)
frame.pack(pady=10)

start_btn = tk.Button(frame, text="Start", command=start_sniffing, bg="green", fg="white")
start_btn.grid(row=0, column=0, padx=10)

stop_btn = tk.Button(frame, text="Stop", command=stop_sniffing, bg="red", fg="white")
stop_btn.grid(row=0, column=1, padx=10)

root.mainloop()