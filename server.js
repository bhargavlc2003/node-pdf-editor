const express = require('express');
const multer = require('multer');
const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/upload', upload.fields([{ name: 'pdfFile' }, { name: 'imageFile' }]), async (req, res) => {
    try {
        // Get file paths
        const pdfFilePath = req.files['pdfFile'][0].path;
        const imageFilePath = req.files['imageFile'][0].path;
        const textToAdd = req.body.text || 'No text provided';

        // Read files
        const pdfBytes = fs.readFileSync(pdfFilePath);
        const imageBytes = fs.readFileSync(imageFilePath);
        const pdfDoc = await PDFDocument.load(pdfBytes);

        // Get image format
        const imageMimeType = req.files['imageFile'][0].mimetype;
        let image;
        if (imageMimeType === 'image/png') {
            image = await pdfDoc.embedPng(imageBytes);
        } else if (imageMimeType === 'image/jpeg' || imageMimeType === 'image/jpg') {
            image = await pdfDoc.embedJpg(imageBytes);
        } else {
            throw new Error('Unsupported image format. Please upload PNG or JPG.');
        }

        // Modify PDF
        const pages = pdfDoc.getPages();
        const lastPage = pages[pages.length - 1];
        const { width } = lastPage.getSize();
        const x = width - 100;
        const y = 100;

        lastPage.drawImage(image, {
            x: x - 50,
            y: y,
            width: 80,
            height: 80,
        });

        lastPage.drawText(`Inserted text:\n${textToAdd}`, {
            x: x - 50,
            y: y - 20,
            size: 10,
            color: rgb(44 / 255, 57 / 255, 179 / 255),
        });

        // Save modified PDF
        const pdfBytesModified = await pdfDoc.save({ useObjectStreams: false });

        // Send response before deleting files
        res.setHeader('Content-Disposition', `attachment; filename="modified-${req.files['pdfFile'][0].originalname}"`);
        res.setHeader('Content-Type', 'application/pdf');
        res.send(Buffer.from(pdfBytesModified));

        // Cleanup uploaded files after response is sent
        res.on('finish', () => {
            fs.unlinkSync(pdfFilePath);
            fs.unlinkSync(imageFilePath);
        });

    } catch (error) {
        console.error(error);
        res.status(500).send(`Error processing PDF: ${error.message}`);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
