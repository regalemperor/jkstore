import Badge from "@/components/ui/badge";

type Product = {
  name: string;
  price: string;
  tag: string;
  visual: string;
  imageUrl?: string | null;
};

export default function ProductCard({ product }: { product: Product }) {
  return (
    <article className="group">
      <div
        className={"relative aspect-[4/5] overflow-hidden rounded-3xl bg-cover bg-center " + product.visual}
        style={product.imageUrl ? { backgroundImage: `url(${product.imageUrl})` } : undefined}
      >
        <Badge>{product.tag}</Badge>
        <button
          type="button"
          className="absolute bottom-4 left-4 right-4 min-h-11 rounded-full bg-white py-3 text-sm font-semibold opacity-0 transition group-hover:opacity-100 focus:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Quick add
        </button>
      </div>
      <div className="flex items-start justify-between gap-4 pt-4">
        <div>
          <h3 className="font-semibold">{product.name}</h3>
          <p className="mt-1 text-sm text-black/50">JKSTORE collection</p>
        </div>
        <p className="font-semibold">{product.price}</p>
      </div>
    </article>
  );
}
