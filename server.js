const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const axios = require('axios');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const natural = require('natural');
const path = require('path');
const upload = multer({ dest: 'uploads/' });
const app = express();
app.use(cors());
//app.use('/uploads', express.static('uploads'));
app.use('/uploads', (req, res, next) => {
    res.setHeader('Content-Disposition', 'attachment');
    next();
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


const sentenceTokenizer = new natural.SentenceTokenizer();

// Function to extract text from a file
async function extractTextFromFile(file) {
    if (file.mimetype === 'application/pdf') {
        const dataBuffer = fs.readFileSync(file.path);
        return await pdfParse(dataBuffer);
    } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const data = await mammoth.extractRawText({ path: file.path });
        return data.value;
    }
    throw new Error('Unsupported file type');
}

// processText is called directly in teh /upload route
// processText then calls spellCheck, which then calls applyCorrection
// Function to process the text and apply corrections
async function processText(text) {
    let changes = [];
    const sentences = sentenceTokenizer.tokenize(text);

    const correctedSentences = await Promise.all(sentences.map(async (sentence, index) => {
        const correctedSentence = await spellCheck(sentence);
        console.log("Original Sentence: ", sentence);
        console.log("Corrected Sentence: ", correctedSentence);
        if (correctedSentence !== sentence) {
            changes.push(`Sentence ${index + 1} corrected.`);
        }
        return correctedSentence;
    }));

    return {
        correctedText: correctedSentences.join(' '),
        changes: changes
    };
}

// Function to call the Bing Spell Check API
async function spellCheck(text) {
    const apiKey = '914f67dcba874566ab43525560bf103c'; // Replace with your Bing API Key
    const endpoint = 'https://api.bing.microsoft.com/v7.0/spellcheck/';

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
        const flaggedTokens = response.data.flaggedTokens;
        let correctedText = text;

        flaggedTokens.forEach(token => {
            let replacement = token.suggestions[0].suggestion;
            if (token.type === "RepeatedToken" && replacement === "") {
                replacement = " ";
            }
            correctedText = applyCorrection(correctedText, token.offset, token.token, replacement);
        });

        return correctedText;
    } catch (error) {
        console.error('Error calling Bing Spell Check API:', error);
        return text;
    }
}

// Function to apply individual corrections
function applyCorrection(text, offset, original, replacement) {
    console.log("Original Text: ", text);
    console.log("Replacement: ", replacement);
    return text.substring(0, offset) + replacement + text.substring(offset + original.length);
}

app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const file = req.file;

        // Extract text from the uploaded file
        const text = await extractTextFromFile(file);

        // Process the extracted text
        const result = await processText(text);

        // Replace the file extension with .txt
        const baseFileName = file.originalname.replace(/\.[^/.]+$/, "");
        const outputFilePath = `uploads/proofread_${baseFileName}.txt`;
        console.log("File path:", outputFilePath); // Log the file path

        // Saving the proofread text as a .txt file
        fs.writeFileSync(outputFilePath, result.correctedText);

        console.log("Sending response:", { 
            fileType: 'txt', 
            filePath: outputFilePath, 
            changes: result.changes 
        });

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

