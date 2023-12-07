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
    const apiKey = '914f67dcba874566ab43525560bf103c'; // Replace with your Bing API Key
    const endpoint = 'https://api.bing.microsoft.com/v7.0/spellcheck/'; // Updated endpoint

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

        // Process the response
        const flaggedTokens = response.data.flaggedTokens;
        let correctedText = text;

        // Apply each correction
        flaggedTokens.forEach(token => {
            let replacement = token.suggestions[0].suggestion; // Using the top suggestion
            if (token.type === "RepeatedToken" && replacement === "") {
                // Handle repeated token case
                replacement = " "; // Replace with a single space
            }
            correctedText = applyCorrection(correctedText, token.offset, token.token, replacement);
        });

        return correctedText;
    } catch (error) {
        console.error('Error calling Bing Spell Check API:', error);
        return text; // Fallback to original text or basic spell checking
    }
}

async function proofreadText(text) {
    let changes = [];
    let sentences = sentenceTokenizer.tokenize(text);

    const proofreadSentences = await Promise.all(sentences.map(async (sentence, index) => {
        const correctedSentence = await contextualProofread(sentence); // Directly using the response
        console.log("Original Sentence: ", sentence);
        console.log("Corrected Sentence: ", correctedSentence);
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

function applyCorrection(text, offset, original, replacement) {
    console.log("Original Text: ", text);
    console.log("Replacement: ", replacement);
    const correctedText = text.substring(0, offset) + replacement + text.substring(offset + original.length);
    console.log("Corrected Text: ", correctedText);
    return correctedText;
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
        console.log('TESTING.....')
        // Saving the proofread text as a .txt file
        console.log({file})
        const outputFilePath = `uploads/proofread_${file.originalname}.txt`;
        fs.writeFileSync(outputFilePath, result.proofreadText);
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
