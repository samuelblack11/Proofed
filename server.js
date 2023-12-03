const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { PDFDocument } = require('pdf-lib');
const mammoth = require('mammoth');
const { Document, Packer, Paragraph } = require('docx');

const upload = multer({ dest: 'uploads/' });
const app = express();
app.use(cors());

function proofreadText(text) {
    let changes = [];
    let lines = text.split('\n');

    lines = lines.map((line, index) => {
        if (line.includes('typrrro')) {
            let updatedLine = line.replace(/typrrro/g, 'typo');
            changes.push(`Line ${index + 1}: Replaced 'typrrro' with 'typo'`);
            return updatedLine;
        }
        return line;
    });

    return {
        proofreadText: lines.join('\n'),
        changes: changes
    };
}

async function createPDF(text) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    page.drawText(text);
    return pdfDoc.save();
}

async function createWordDocument(text) {
    const doc = new Document();
    const paragraphs = text.split('\n').map(line => new Paragraph(line));
    doc.addSection({ children: paragraphs });
    return Packer.toBuffer(doc);
}

app.post('/upload', upload.single('file'), async (req, res) => {
    const file = req.file;
    const fileType = file.mimetype;

    if (fileType === 'application/pdf') {
        const dataBuffer = fs.readFileSync(file.path);
        try {
            const data = await pdfParse(dataBuffer);
            const result = proofreadText(data.text);
            const pdfBytes = await createPDF(result.proofreadText);
            res.send({ fileType: 'pdf', data: pdfBytes.toString('base64'), changes: result.changes });
        } catch (error) {
            console.error('Error processing PDF:', error);
            res.status(500).send('Error processing PDF');
        }
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        try {
            const data = await mammoth.extractRawText({ path: file.path });
            const result = proofreadText(data.value);
            const docBuffer = await createWordDocument(result.proofreadText);
            res.send({ fileType: 'docx', data: docBuffer.toString('base64'), changes: result.changes });
        } catch (error) {
            console.error('Error processing Word document:', error);
            res.status(500).send('Error processing Word document');
        }
    } else {
        res.status(400).send('Unsupported file type');
    }
});

app.listen(3000, () => console.log('Server running on port 3000'));
