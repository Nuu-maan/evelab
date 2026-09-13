import { IconArrowUpRight, IconCheckCircle, IconCircle } from "@/components/icons";
import { Icon } from "@/components/icon";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { platformProducts } from "@/lib/vercel-platform";

/**
 * The Vercel products EveLab runs on, and whether each is on. Every product has
 * a working fallback, so this reads as "what you gain", never as a wall of errors.
 */
export function VercelPlatformCard() {
  const products = platformProducts(process.env);
  const on = products.filter((product) => product.configured).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vercel</CardTitle>
        <CardDescription>
          {on === products.length
            ? "Every Vercel product EveLab uses is connected."
            : `${on} of ${products.length} connected. EveLab works without the rest and uses them as soon as they are set on the server.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="platform-list" aria-label="Vercel products">
          {products.map((product) => (
            <li key={product.id} className="platform-item" data-configured={product.configured || undefined}>
              <Icon icon={product.configured ? IconCheckCircle : IconCircle} className="platform-icon" />
              <div className="platform-text">
                <p className="platform-name">
                  {product.name}
                  <span className="visually-hidden">{product.configured ? ", connected" : ", not connected"}</span>
                </p>
                <p className="platform-role">{product.configured ? product.role : product.fallback}</p>
                {!product.configured && (
                  <p className="platform-env">
                    Set <code className="mono">{product.env.join(" ")}</code>
                  </p>
                )}
              </div>
              <a className="platform-docs" href={product.docs} target="_blank" rel="noreferrer noopener" aria-label={`${product.name} docs`}>
                <Icon icon={IconArrowUpRight} size={14} />
              </a>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
