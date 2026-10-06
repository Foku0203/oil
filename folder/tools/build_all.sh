#!/bin/bash
# Rebuild and verify every Thai PDF, then merge them into output/ALL-AWS-ACO-TH.pdf
cd "$(dirname "$0")/.." || exit 1
while IFS='|' read -r stem title; do
  python3 tools/build.py "$stem" "$title" >/dev/null || exit 1
  python3 tools/verify.py "$stem" | tail -1
done <<'LIST'
ACO-01-Understanding-Systems-Operations-on-AWS|โมดูล 1: ทำความเข้าใจการปฏิบัติการระบบบน AWS (Understanding Systems Operations on AWS)
ACO-02-Tooling-and-Automation|โมดูล 2: เครื่องมือและระบบอัตโนมัติ (Tooling and Automation)
ACO-03-Computing-Servers|โมดูล 3: การประมวลผล – เซิร์ฟเวอร์ (Computing: Servers)
ACO-04-Computing-Scaling-and-Name-Resolution|โมดูล 4: การประมวลผล – การขยายขนาดและการแปลงชื่อ (Computing: Scaling and Name Resolution)
ACO-05-Computing-Containers-and-Serverless|โมดูล 5: การประมวลผล – คอนเทนเนอร์และ Serverless (Computing: Containers and Serverless)
ACO-06-Computing-Database-Services|โมดูล 6: การประมวลผล – บริการฐานข้อมูล (Computing: Database Services)
ACO-07-Networking|โมดูล 7: เครือข่าย (Networking)
ACO-08-Storage-and-Archiving|โมดูล 8: พื้นที่จัดเก็บและการเก็บถาวร (Storage and Archiving)
lab1|Lab 1: การใช้ AWS Systems Manager (Using AWS Systems Manager)
lab2|Lab 2: การสร้าง Amazon EC2 Instances (Creating Amazon EC2 Instances)
lab3|Lab 3: การใช้ Auto Scaling (Using Auto Scaling)
lab4|Lab 4: ตั้งค่า VPC (Configure VPC)
lab5|Lab 5: การจัดการพื้นที่จัดเก็บ (Managing Storage)
lab6|Lab 6: การเฝ้าติดตามโครงสร้างพื้นฐาน (Monitoring Infrastructure)
lab7|Lab 7: การจัดการทรัพยากรด้วย Tagging (Managing Resources with Tagging)
lab8|Lab 8: ระบบอัตโนมัติด้วย CloudFormation (Automation with CloudFormation)
LIST
python3 - <<'PY'
from pypdf import PdfWriter
import glob
order = sorted(glob.glob("output/ACO-0*-TH.pdf")) + [f"output/lab{i}-TH.pdf" for i in range(1, 9)]
w = PdfWriter()
for f in order:
    w.append(f, outline_item=f.split("/")[-1].replace("-TH.pdf", ""))
w.write("output/ALL-AWS-ACO-TH.pdf")
PY
pdfinfo output/ALL-AWS-ACO-TH.pdf | grep Pages
