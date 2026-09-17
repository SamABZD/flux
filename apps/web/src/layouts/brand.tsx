import { Link } from 'react-router';
export function Brand({ to = '/home' }: { to?: string }) {
  return (
    <Link to={to} className="brand" aria-label="Flux home">
      <span className="brand-mark" aria-hidden="true" />
      <span>
        Flux<span className="brand-period">.</span>
      </span>
    </Link>
  );
}
