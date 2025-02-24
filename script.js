let pdfFileName = '';
let pdfDoc = null;
const pdfInput = document.getElementById('pdfInput');
const previewImage = document.getElementById('previewImage');
const convertButton = document.getElementById('convertButton');
const clearButton = document.getElementById('clearButton');
const resultSection = document.getElementById('resultSection');
const resultInfo = document.getElementById('resultInfo');
const downloadLink = document.getElementById('downloadLink');
const errorMessage = document.getElementById('errorMessage');
const scaleInput = document.getElementById('scale');
const scaleValue = document.getElementById('scaleValue');
const formatSelect = document.getElementById('format');
const qualityInput = document.getElementById('quality');
const qualityValue = document.getElementById('qualityValue');
const jpegQuality = document.getElementById('jpegQuality');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
const controls = document.getElementById('controls');

// Set pdf.js worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// Event Listeners
pdfInput.addEventListener('change', handlePDFUpload);
controls.addEventListener('dragover', (e) => {
    e.preventDefault();
    controls.classList.add('dragover');
});
controls.addEventListener('dragleave', () => controls.classList.remove('dragover'));
controls.addEventListener('drop', (e) => {
    e.preventDefault();
    controls.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) {
        pdfInput.files = e.dataTransfer.files;
        handlePDFUpload({ target: { files: [file] } });
    }
});
scaleInput.addEventListener('input', () => scaleValue.textContent = scaleInput.value);
formatSelect.addEventListener('change', () => {
    jpegQuality.classList.toggle('hidden', formatSelect.value !== 'jpeg');
});
qualityInput.addEventListener('input', () => qualityValue.textContent = qualityInput.value);

document.querySelectorAll('.faq-question').forEach(button => {
    button.addEventListener('click', () => {
        const faqItem = button.parentElement;
        const isActive = faqItem.classList.contains('active');
        
        document.querySelectorAll('.faq-item').forEach(item => {
            if (item !== faqItem) item.classList.remove('active');
            item.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
        });
        
        faqItem.classList.toggle('active');
        button.setAttribute('aria-expanded', !isActive);
        
        const answer = faqItem.querySelector('.faq-answer');
        if (faqItem.classList.contains('active')) {
            answer.style.maxHeight = answer.scrollHeight + 'px';
        } else {
            answer.style.maxHeight = '0';
        }
    });
});

async function handlePDFUpload(e) {
    const file = e.target.files[0];
    if (!file || !file.type.match('application/pdf')) {
        showError('Please upload a valid PDF file!');
        pdfInput.value = '';
        previewImage.style.display = 'none';
        return;
    }

    clearError();
    pdfFileName = file.name.split('.').slice(0, -1).join('.');
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const typedArray = new Uint8Array(e.target.result);
            pdfDoc = await pdfjsLib.getDocument(typedArray).promise;
            const page = await pdfDoc.getPage(1);
            const scale = parseFloat(scaleInput.value);
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({ canvasContext: ctx, viewport }).promise;
            previewImage.src = canvas.toDataURL('image/png');
            previewImage.style.display = 'block';
            convertButton.disabled = false;
            resultSection.classList.remove('visible');
        } catch (error) {
            showError('Error loading PDF: ' + error.message);
            clearForm();
        }
    };
    reader.readAsArrayBuffer(file);
}

async function convertPDF() {
    if (!pdfDoc) {
        showError('Please upload a PDF file first!');
        return;
    }

    convertButton.disabled = true;
    convertButton.textContent = 'Converting...';
    progressBar.style.display = 'block';
    clearError();

    try {
        const zip = new JSZip();
        const numPages = pdfDoc.numPages;
        let totalSize = 0;
        const scale = parseFloat(scaleInput.value);
        const format = formatSelect.value;
        const quality = format === 'jpeg' ? parseFloat(qualityInput.value) : null;

        for (let i = 1; i <= numPages; i++) {
            progressFill.style.width = `${(i / numPages) * 100}%`;
            resultInfo.textContent = `Converting page ${i} of ${numPages}...`;

            const page = await pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({ canvasContext: ctx, viewport }).promise;

            const imageType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
            const imageDataUrl = await new Promise(resolve => {
                canvas.toBlob(blob => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                }, imageType, quality || 1);
            });

            const byteString = atob(imageDataUrl.split(',')[1]);
            totalSize += byteString.length;
            const fileName = `${pdfFileName}-page${i}.${format}`;
            zip.file(fileName, byteString, { binary: true });
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const zipSize = (totalSize / 1024 / 1024).toFixed(2); // Size in MB
        const zipDataUrl = URL.createObjectURL(zipBlob);

        resultInfo.textContent = `Converted ${numPages} page(s) to ${format.toUpperCase()} | Total Size: ${zipSize} MB`;
        downloadLink.href = zipDataUrl;
        downloadLink.download = `${pdfFileName}-images.zip`;
        resultSection.classList.add('visible');
    } catch (error) {
        showError('Error converting PDF: ' + error.message);
    } finally {
        convertButton.disabled = false;
        convertButton.textContent = 'Convert All Pages';
        progressBar.style.display = 'none';
    }
}

function clearForm() {
    pdfInput.value = '';
    previewImage.src = '';
    previewImage.style.display = 'none';
    pdfDoc = null;
    convertButton.disabled = true;
    resultSection.classList.remove('visible');
    clearError();
    progressBar.style.display = 'none';
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
}

function clearError() {
    errorMessage.textContent = '';
    errorMessage.style.display = 'none';
}
