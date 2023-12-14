require('dotenv').config({ path: 'azureCreds.env' });
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
app.use(express.static(path.join(__dirname, 'frontend/build')));
const { DefaultAzureCredential } = require('@azure/identity');
const credential = new DefaultAzureCredential({
  clientId: process.env.AZURE_CLIENT_ID,
  tenantId: process.env.AZURE_TENANT_ID,
  clientSecret: process.env.AZURE_CLIENT_SECRET,
});
const { SecretClient } = require('@azure/keyvault-secrets');
const keyVaultName = "SalooKeys";
const keyVaultUrl = `https://${keyVaultName}.vault.azure.net/`;
const client = new SecretClient(keyVaultUrl, credential);
const port = process.env.PORT || 8080;
app.use(cors());
//app.use('/uploads', express.static('uploads'));
app.use('/uploads', (req, res, next) => {
    res.setHeader('Content-Disposition', 'attachment');
    next();
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

//
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

// Function to process the text and apply corrections
async function processText(text) {
    let changes = [];
    const sentences = sentenceTokenizer.tokenize(text);

    const correctedSentences = await Promise.all(sentences.map(async (sentence, index) => {
        const correctedSentence = await spellCheck(sentence);

        if (correctedSentence !== sentence) {
            // Record the original and corrected sentences
            changes.push({
                original: sentence,
                corrected: correctedSentence,
                index: index + 1 // Keep track of sentence number for reference
            });
        }
        return correctedSentence;
    }));

    // Combine the corrected sentences into a single text
    const correctedText = correctedSentences.join(' ');

    // Format changes for output
    const changesText = changes.map(change => 
        `Original (Sentence ${change.index}): "${change.original}"\nCorrected: "${change.corrected}"\n`
    ).join('\n');

    return {
        correctedText: correctedText,
        changesText: changesText // Return the formatted changes text
    };
}


// Function to call the Bing Spell Check API
async function spellCheck(text) {
    const secretName = "BingSpellCheck2";
    const apiKeySecret = await client.getSecret(secretName);
    const apiKey = apiKeySecret.value;
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
        const outputFilePath = `uploads/proofed_${baseFileName}.txt`;
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
            changes: result.changesText
        });
    } catch (error) {
        console.error('Error processing file:', error);
        res.status(500).send('Error processing file');
    }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/build', 'index.html'));
});
