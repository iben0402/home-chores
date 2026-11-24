/** Temporary screen used until each feature plan builds the real one. */
export default function Placeholder({ title }: { title: string }) {
  return (
    <section className="py-10 text-center">
      <h1 className="text-3xl font-semibold text-primary">{title}</h1>
      <p className="mt-2 text-sm opacity-60">Coming soon</p>
    </section>
  )
}
