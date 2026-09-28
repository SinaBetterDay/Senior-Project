const baseUrl = process.env.SEARCH_URL ?? 'http://localhost:3001';
const query = process.env.SEARCH_QUERY ?? '700';
const sampleCount = 5;
const maxAllowedMs = 500;

async function measureSearch() {
  const url = `${baseUrl}/api/search?q=${encodeURIComponent(query)}`;
  const start = performance.now();

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Search returned HTTP ${response.status}`);
  }

  await response.json();

  return performance.now() - start;
}

async function main() {
  console.log(`Benchmarking ${baseUrl}/api/search?q=${query}`);

  // Warm up the server and database connection.
  await measureSearch();

  const timings = [];

  for (let index = 0; index < sampleCount; index += 1) {
    timings.push(await measureSearch());
  }

  const averageMs =
    timings.reduce((total, timing) => total + timing, 0) / timings.length;
  const fastestMs = Math.min(...timings);
  const slowestMs = Math.max(...timings);

  console.table(
    timings.map((duration, index) => ({
      request: index + 1,
      milliseconds: Number(duration.toFixed(2)),
    })),
  );

  console.log(`Fastest: ${fastestMs.toFixed(2)} ms`);
  console.log(`Average: ${averageMs.toFixed(2)} ms`);
  console.log(`Slowest: ${slowestMs.toFixed(2)} ms`);

  if (slowestMs >= maxAllowedMs) {
    throw new Error(
      `Search exceeded the ${maxAllowedMs} ms acceptance criterion.`,
    );
  }

  console.log(
    `PASS: all measured searches completed in under ${maxAllowedMs} ms.`,
  );
}

main().catch((error) => {
  console.error('Search benchmark failed:', error.message);
  process.exitCode = 1;
});