# Security and privacy

SafeShot is meant to keep sensitive data out of the images you share, so two kinds of problems matter here.

## Reporting a detection gap

If SafeShot missed a kind of data it should have found, open an issue with:

- the category (for example CPF, phone, Pix key);
- the text as the OCR read it, using made-up values that keep the same shape;
- the theme of the screenshot (light or dark).

Please do not attach a real screenshot.

## Reporting a privacy problem

If you find that the app writes an image to disk you did not ask for, makes a network connection, logs recognized text, or exports a file that still contains the covered pixels or trailing data after the PNG `IEND` chunk, report it privately through the repository's security advisories page (Security tab, "Report a vulnerability"). Include the version and the steps to reproduce.

## What the app promises

- OCR runs locally with files bundled in the app. The webview policy blocks external connections.
- No image is written except the export you request, and the original file is never overwritten.
- Every export is decoded again and checked before it is handed over.
- Detection is best effort. Always look at the exported image before sending it.
