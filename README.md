# Cybersecurity Projects Collection

A collection of cybersecurity tools and applications built with Python and web technologies.

## Projects Included

### 1. Packet Sniffer (`packet-sniffer/`)
- **sniffer.py**: Command-line packet sniffing tool
- **sniffer_gui.py**: GUI version with tkinter interface

### 2. Password Strength Checker (`password-checker/`)
- Web-based password strength analyzer
- HTML/CSS/JavaScript implementation

### 3. Phishing Detector (`phishing-detector/`)
- Machine learning-based phishing detection system
- Flask web application
- Features URL and email analysis

### 4. SQL Scanner (`sql-scanner/`)
- SQL injection vulnerability scanner
- Flask web application

## Setup Instructions

### Prerequisites
- Python 3.7+
- Required packages: `flask`, `pandas`, `scikit-learn`, `scapy` (for packet sniffer)

### Installation
```bash
# Clone the repository
git clone https://github.com/SapoliyaDhruv/CSProject.git
cd CSProject

# Install dependencies (example for phishing detector)
pip install flask pandas scikit-learn
```

### Dataset Setup for Phishing Detector
The phishing detector requires training datasets that are too large for GitHub. Download them separately:

1. **URL Dataset**: Download from [PhiUSIIL Phishing URL Dataset](https://www.kaggle.com/datasets/shashankrustagi/phishing-dataset)
2. **Email Dataset**: Download from [PhiUSIIL Phishing URL Dataset](https://www.kaggle.com/datasets/shashankrustagi/phishing-dataset)
2. **Email Dataset**: Download from [Phishing Email Dataset](https://www.kaggle.com/datasets/subhajournal/phishingemails)

Place the CSV files in `phishing-detector/dataset/` directory:
- `PhiUSIIL_Phishing_URL_Dataset.csv`
- `phishing_email.csv`

### Training Models
```bash
# Train URL detection model
python phishing-detector/train_url_model.py

# Train email detection model
python phishing-detector/train_email_model.py
```

### Running Applications
```bash
# Phishing Detector
python phishing-detector/app.py

# SQL Scanner
python sql-scanner/app.py

# Packet Sniffer (GUI)
python packet-sniffer/sniffer_gui.py
```

## Usage

Each project has its own web interface accessible at `http://localhost:5000` (or specified port).

## Note on Large Files

Dataset files are excluded from this repository due to GitHub's file size limits. You must download them separately to train the phishing detection models.

## Contributing

Feel free to contribute improvements or additional cybersecurity tools!

## License

This project is for educational purposes. Use responsibly and in compliance with applicable laws.