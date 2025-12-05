#!/usr/bin/env node

/**
 * Generate favicon.ico from SVG
 * Creates a 16x16 ICO file with a simple musical note design
 */

const fs = require('fs');
const path = require('path');

// Simple ICO header for a 16x16 1-bit image
// This is a minimal valid ICO file with a musical note pattern
const createFaviconICO = () => {
  // ICO file structure:
  // - ICONDIR (6 bytes)
  // - ICONDIRENTRY (16 bytes per image)
  // - ICONIMAGE data

  // For simplicity, we'll create a minimal 16x16 favicon
  // ICO Header
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);      // Reserved
  header.writeUInt16LE(1, 2);      // Type (1 = ICO)
  header.writeUInt16LE(1, 4);      // Number of images

  // Icon Directory Entry (16 bytes)
  const entry = Buffer.alloc(16);
  entry.writeUInt8(16, 0);         // Width
  entry.writeUInt8(16, 1);         // Height
  entry.writeUInt8(0, 2);          // Color count (0 = no palette)
  entry.writeUInt8(0, 3);          // Reserved
  entry.writeUInt16LE(1, 4);       // Color planes
  entry.writeUInt16LE(32, 6);      // Bits per pixel (32 = ARGB)
  entry.writeUInt32LE(1174, 8);    // Size of image data
  entry.writeUInt32LE(22, 12);     // Offset to image data

  // Image data: 16x16 ARGB pixels
  // Create a simple musical note pattern
  const imageData = Buffer.alloc(16 * 16 * 4);

  // Fill with semi-transparent blue background
  for (let i = 0; i < imageData.length; i += 4) {
    imageData[i] = 26;        // R (26)
    imageData[i + 1] = 26;    // G (26)
    imageData[i + 2] = 46;    // B (46)
    imageData[i + 3] = 200;   // A (200)
  }

  // Draw a simple musical note using cyan pixels (0, 212, 255)
  // Note head (small circle at bottom)
  for (let y = 10; y < 14; y++) {
    for (let x = 6; x < 10; x++) {
      const idx = (y * 16 + x) * 4;
      imageData[idx] = 0;       // R
      imageData[idx + 1] = 212; // G
      imageData[idx + 2] = 255; // B
      imageData[idx + 3] = 255; // A
    }
  }

  // Stem (vertical line)
  for (let y = 2; y < 11; y++) {
    const idx = (y * 16 + 8) * 4;
    imageData[idx] = 0;       // R
    imageData[idx + 1] = 212; // G
    imageData[idx + 2] = 255; // B
    imageData[idx + 3] = 255; // A
  }

  // Beam (horizontal top)
  for (let x = 8; x < 13; x++) {
    const idx = (2 * 16 + x) * 4;
    imageData[idx] = 0;       // R
    imageData[idx + 1] = 212; // G
    imageData[idx + 2] = 255; // B
    imageData[idx + 3] = 255; // A
  }

  // Combine all parts
  return Buffer.concat([header, entry, imageData]);
};

// Generate and write the favicon
const faviconData = createFaviconICO();
const outputPath = path.join(__dirname, 'favicon.ico');

fs.writeFileSync(outputPath, faviconData);
console.log(`✓ favicon.ico created successfully at ${outputPath}`);
console.log(`  Size: ${faviconData.length} bytes`);
