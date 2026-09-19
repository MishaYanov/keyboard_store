import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp'; // [1] Import sharp for image processing

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

async function convertJpgToWebp() {
    const dir = path.resolve(scriptDir, '../public/assets/images');
    console.log(dir);
    try {
        const files = await fs.promises.readdir(dir);
        const jpgFiles = files.filter(file => /\.(jpg|jpeg)$/i.test(file));

        if (jpgFiles.length === 0) {
            console.log('No JPG images found.');
            return;
        }

        for (const file of jpgFiles) {
            const inputPath = path.join(dir, file);
            const outputPath = path.join(dir, `${path.parse(file).name}.webp`);

            // Sharp handles reading, converting, and writing efficiently
            await sharp(inputPath)
                .webp({ quality: 60, effort: 6 })
                .toFile(outputPath);

            console.log(`Successfully converted: ${file} -> ${path.parse(file).name}.webp`);
        }

        console.log('Batch processing complete!');
    } catch (err) {
        console.error('Error processing files:', err.message);
    }
}

convertJpgToWebp();
