// script.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';

const uploadArea = document.getElementById('upload-area');
const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');
const progressBar = document.getElementById('progress-bar');
const progress = document.getElementById('progress');
const status = document.getElementById('status');
const error = document.getElementById('error');
const resultsBody = document.getElementById('results-body');
const downloadBtn = document.getElementById('download-btn');
const fileListEl = document.getElementById('file-names');

let extractedData = [];

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('highlight');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('highlight');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('highlight');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        fileInput.files = files;
        handleFiles(files);
    }
});

uploadBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
        handleFiles(fileInput.files);
    }
});

downloadBtn.addEventListener('click', downloadExcel);

async function handleFiles(files) {
    error.textContent = '';
    const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');

    if (pdfFiles.length === 0) {
        error.textContent = 'Please upload PDF files only.';
        return;
    }

    fileListEl.innerHTML = '';
    pdfFiles.forEach(file => {
        const li = document.createElement('li');
        li.textContent = `📎 ${file.name}`;
        fileListEl.appendChild(li);
    });

    progressBar.style.display = 'block';
    status.textContent = `Processing ${pdfFiles.length} PDF(s)...`;

    for (let i = 0; i < pdfFiles.length; i++) {
        const file = pdfFiles[i];
        progress.style.width = `${((i + 1) / pdfFiles.length) * 100}%`;
        status.textContent = `Processing ${i + 1} of ${pdfFiles.length}: ${file.name}`;

        try {
            const data = await extractDataFromPDF(file);
            extractedData.push(data);
            addToResultsTable(data);
        } catch (err) {
            console.error(`Error processing ${file.name}:`, err);
            const errorData = {
                pdfName: file.name,
                name: 'EXTRACTION_ERROR',
                mobile: 'EXTRACTION_ERROR',
                email: 'EXTRACTION_ERROR'
            };
            extractedData.push(errorData);
            addToResultsTable(errorData);
        }
    }

    progressBar.style.display = 'none';
    status.textContent = `Completed processing ${pdfFiles.length} PDF(s)`;
    downloadBtn.style.display = 'inline-block';
}

async function extractDataFromPDF(file) {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();

        fileReader.onload = async function() {
            try {
                const typedArray = new Uint8Array(this.result);
                const pdf = await pdfjsLib.getDocument(typedArray).promise;
                const page = await pdf.getPage(1);
                const textContent = await page.getTextContent();

                // Find the largest font size item assumed to be the name
                let maxFontSize = 0;
                let probableName = '';
                for (let item of textContent.items) {
                    const fontSize = item.transform[0];
                    const text = item.str.trim();
                    if (
                        text &&
                        /^[A-Z][a-z]+(?:\s[A-Z][a-z]+){1,2}$/.test(text) &&
                        fontSize > maxFontSize
                    ) {
                        maxFontSize = fontSize;
                        probableName = text;
                    }
                }
                const name = probableName || 'Not Found';

                const fullText = textContent.items.map(item => item.str).join('\n');

                // Extract Mobile
                let mobile = null;
                const mobilePatterns = [
                    /(\d{10})\s*\(Mobile\)/,
                    /(?<!\d)([6-9]\d{9})(?!\d)/,
                    /Contact\s*\n.*?(\d{10})/
                ];
                for (const pattern of mobilePatterns) {
                    const match = fullText.match(pattern);
                    if (match) {
                        mobile = match[1];
                        break;
                    }
                }

                // Extract Email
                const emailMatch = fullText.match(/([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i);
                const email = emailMatch ? emailMatch[1] : 'Not Found';

                resolve({
                    pdfName: file.name,
                    name,
                    mobile: mobile || 'Not Found',
                    email
                });
            } catch (err) {
                reject(err);
            }
        };

        fileReader.onerror = reject;
        fileReader.readAsArrayBuffer(file);
    });
}

function addToResultsTable(data) {
    const row = document.createElement('tr');
    row.innerHTML = `
       
        <td>${data.name}</td>
        <td>${data.mobile}</td>
        <td>${data.email}</td>
    `;
    resultsBody.appendChild(row);
}

function downloadExcel() {
    if (extractedData.length === 0) {
        error.textContent = 'No data to download';
        return;
    }

    const ws = XLSX.utils.json_to_sheet(extractedData.map(item => ({

        'Name': item.name,
        'Mobile': item.mobile,
        'Email': item.email
    })));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Extracted Contacts');
    XLSX.writeFile(wb, 'Extracted_Contacts.xlsx');
}