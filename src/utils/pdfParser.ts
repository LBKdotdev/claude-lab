import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export async function parsePDF(file: File): Promise<any[]> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const allItems: any[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      const textItems = textContent.items.map((item: any) => ({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
      }));

      textItems.sort((a, b) => {
        if (Math.abs(b.y - a.y) > 5) return b.y - a.y;
        return a.x - b.x;
      });

      const rows = groupIntoRows(textItems);
      const pageItems = parseTableRows(rows);
      allItems.push(...pageItems);
    }

    return allItems;
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function groupIntoRows(textItems: any[]): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let lastY = textItems[0]?.y;

  for (const item of textItems) {
    if (Math.abs(item.y - lastY) > 5) {
      if (currentRow.length > 0) {
        rows.push(currentRow);
      }
      currentRow = [item.str];
      lastY = item.y;
    } else {
      currentRow.push(item.str);
    }
  }

  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  return rows;
}

function parseTableRows(rows: string[][]): any[] {
  const items: any[] = [];

  for (const row of rows) {
    const rowText = row.join(' ');

    const yearMatch = rowText.match(/^\s*(\d{4})\s/);
    if (!yearMatch) continue;

    const year = yearMatch[1];

    const makeMatch = rowText.match(/\d{4}\s+(KAWASAKI|CAN-AM|CANAM)/i);
    if (!makeMatch) continue;

    const make = makeMatch[1].replace('CANAM', 'CAN-AM');

    let remainingText = rowText.substring(rowText.indexOf(make) + make.length).trim();

    const vinMatch = remainingText.match(/([A-Z0-9]{17})/);
    const vin = vinMatch ? vinMatch[1] : '';

    const scoreMatch = remainingText.match(/\s(\d{2})\s*(?:AZ|CA|TX|NM|WA|ID|PA|OR|NV|VA)\s/);
    const score = scoreMatch ? scoreMatch[1] : '';

    const docMatch = remainingText.match(/(AZ|CA|TX|NM|WA|ID|PA|OR|NV|VA)\s+(TITLE|REG|SALE\s*DOCS|CMG)/i);
    const docType = docMatch ? `${docMatch[1]} ${docMatch[2]}` : '';

    const mileageMatch = remainingText.match(/\s([A-Z0-9]{1,10})\s+[A-Z0-9]{17}/);
    const mileage = mileageMatch ? mileageMatch[1] : '';

    let model = '';
    if (vinMatch) {
      const modelEndIndex = remainingText.indexOf(mileageMatch?.[1] || vinMatch[1]);
      model = remainingText.substring(0, modelEndIndex).trim();
    }

    const title = `${year} ${make} ${model}`.trim();

    if (year && make) {
      items.push({
        'Item #': '',
        itemNumber: '',
        Year: year,
        year: year,
        Make: make,
        make: make,
        Model: model,
        model: model,
        title: title,
        Title: title,
        'Mi/Hr': mileage,
        'Miles/Hours': mileage,
        milesHours: mileage,
        VIN: vin,
        vin: vin,
        Score: score,
        'CR Score': score,
        CRScore: score,
        crScore: score,
        'Online Bid': '',
        'Vehicle Doc': docType,
        Docs: docType,
        docs: docType,
        Location: 'San Diego',
        location: 'San Diego',
      });
    }
  }

  return items;
}
