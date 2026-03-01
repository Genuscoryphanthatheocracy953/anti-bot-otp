export async function solvePow(nonce: string, difficulty: number): Promise<string> {
  let counter = 0;
  const target = '0'.repeat(Math.floor(difficulty / 4));

  while (true) {
    const candidate = `${nonce}${counter}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(candidate);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);

    // Check leading zero bits
    if (hasLeadingZeroBits(hashArray, difficulty)) {
      return counter.toString();
    }

    counter++;

    // Yield to UI every 10000 iterations
    if (counter % 10000 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
}

function hasLeadingZeroBits(hash: Uint8Array, requiredBits: number): boolean {
  let bitsChecked = 0;
  for (let i = 0; i < hash.length && bitsChecked < requiredBits; i++) {
    const byte = hash[i];
    for (let bit = 7; bit >= 0 && bitsChecked < requiredBits; bit--) {
      if ((byte >> bit) & 1) return false;
      bitsChecked++;
    }
  }
  return true;
}
