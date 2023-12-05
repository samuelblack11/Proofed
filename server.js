const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const natural = require('natural');
const sentenceTokenizer = new natural.SentenceTokenizer();
const tokenizer = new natural.WordTokenizer();
const axios = require('axios');
const upload = multer({ dest: 'uploads/' });
const app = express();
app.use(cors());

async function contextualProofread(text) {
    const apiKey = '###'; // Replace with your Bing API Key
    const endpoint = 'https://api.bing.microsoft.com/'; // Replace with your Bing API Endpoint

    try {
        const params = new URLSearchParams({ 
            'text': text,
            'mode': 'proof' // Use 'proof' mode for more rigorous checks
        });

        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Ocp-Apim-Subscription-Key': apiKey
        };

        const response = await axios.post(endpoint, params.toString(), { headers });
        
        // Process the response here
        // The response format will depend on the API documentation
        return response.data;
    } catch (error) {
        console.error('Error calling Bing Spell Check API:', error);
        return text; // Fallback to original text or basic spell checking
    }
}

async function proofreadText(text) {
    let changes = [];
    let sentences = sentenceTokenizer.tokenize(text);

    const proofreadSentences = await Promise.all(sentences.map(async (sentence, index) => {
        const response = await contextualProofread(sentence);
        
        // Process the response to apply corrections and record changes
        // Simplified example: Adjust according to the actual API response format
        let correctedSentence = response.correctedText; // Assuming the API returns the corrected sentence
        if (correctedSentence !== sentence) {
            changes.push(`Sentence ${index + 1} corrected.`);
        }
        return correctedSentence;
    }));

    return {
        proofreadText: proofreadSentences.join(' '),
        changes: changes
    };
}

app.post('/upload', upload.single('file'), async (req, res) => {
    const file = req.file;
    const fileType = file.mimetype;

    try {
        let text;
        if (fileType === 'application/pdf') {
            const dataBuffer = fs.readFileSync(file.path);
            const data = await pdfParse(dataBuffer);
            text = data.text;
        } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const data = await mammoth.extractRawText({ path: file.path });
            text = data.value;
        } else {
            res.status(400).send('Unsupported file type');
            return;
        }

        // Proofreading the extracted text
        const result = await proofreadText(text);
        
        // Saving the proofread text as a .txt file
        const outputFilePath = `uploads/proofread_${file.originalname}.txt`;
        fs.writeFileSync(outputFilePath, result.proofreadText);

        res.send({ 
            fileType: 'txt', 
            filePath: outputFilePath, 
            changes: result.changes 
        });
    } catch (error) {
        console.error('Error processing file:', error);
        res.status(500).send('Error processing file');
    }
});

app.listen(3000, () => console.log('Server running on port 3000'));
