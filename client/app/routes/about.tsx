export function meta() {
  return [
    { title: "About" },
    { name: "description", content: "About this app" },
  ];
}

export default function About() {
  return (
    <main>
      <h1>About Page</h1>
      <p>This is the about page.</p>
    </main>
  );
}