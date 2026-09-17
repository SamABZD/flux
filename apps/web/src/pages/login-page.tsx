import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Fingerprint, ShieldCheck, ArrowUpRight } from '@phosphor-icons/react';
import { Brand } from '@/layouts/brand';
import { Input } from '@/design-system/input';
import { PasswordInput } from '@/design-system/password-input';
import { Button } from '@/design-system/button';
import { ErrorState } from '@/design-system/feedback';
import { Badge } from '@/design-system/badge';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const emailError =
    submitted && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ? 'Enter a valid email address.'
      : undefined;
  const passwordError = submitted && !password ? 'Enter your password.' : undefined;
  useEffect(() => {
    document.title = 'Sign in · Flux';
  }, []);
  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      event.currentTarget.querySelector<HTMLInputElement>('[name=email]')?.focus();
    else if (!password)
      event.currentTarget.querySelector<HTMLInputElement>('[name=password]')?.focus();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && password) {
      setUnavailable(true);
      setPassword('');
      setSubmitted(false);
    }
  }
  return (
    <main className="login-layout">
      <aside className="login-story">
        <Brand />
        <div className="login-statement">
          <Badge>Clarity, by design</Badge>
          <h2>
            A little less noise.
            <br />A lot more <span>possibility.</span>
          </h2>
          <p>
            A considered space for your money.
            <br />
            And everything you want to do with it.
          </p>
        </div>
        <div className="login-art" aria-hidden="true">
          <div className="orbit orbit--one" />
          <div className="orbit orbit--two" />
          <div className="orbit orbit--three" />
          <div className="login-art-mark">
            <span />
            <span />
          </div>
          <div className="orbit-point" />
        </div>
        <div className="login-story-footer">
          <span>Built around your everyday.</span>
          <span>Flux © {new Date().getFullYear()}</span>
        </div>
      </aside>
      <section className="login-form-panel" aria-labelledby="login-title">
        <div className="login-mobile-brand">
          <Brand />
        </div>
        <Link to="/home" className="login-explore">
          Take a look around <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
        <div className="login-form-content">
          <div className="login-title">
            <h1 id="login-title">Welcome back.</h1>
            <p>Your space is right where you left it.</p>
          </div>
          <form onSubmit={submit} noValidate>
            <Input
              label="Email address"
              type="email"
              name="email"
              autoComplete="username"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setUnavailable(false);
              }}
              error={emailError}
              required
            />
            <PasswordInput
              label="Password"
              name="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setUnavailable(false);
              }}
              error={passwordError}
              required
            />
            {unavailable && (
              <ErrorState
                title="Sign-in is not connected yet"
                description="Use Try Demo to explore Flux. Your credentials have not been sent or saved."
              />
            )}
            <Button type="submit" className="full-width" trailingIcon={<ArrowRight size={18} />}>
              Sign in
            </Button>
          </form>
          <div className="auth-divider">
            <span />
            or
            <span />
          </div>
          <Button
            variant="secondary"
            className="full-width"
            leadingIcon={<Fingerprint size={21} />}
            disabled
          >
            Use a passkey <span className="coming-soon">Soon</span>
          </Button>
          <div className="try-demo">
            <span>Just looking around?</span>
            <Link className="text-link" to="/home">
              Try Demo <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
          <p className="login-demo-note">
            <ShieldCheck size={17} aria-hidden="true" />A product preview. No real accounts or
            money.
          </p>
        </div>
        <div className="login-footer">
          <span>Thoughtfully simple.</span>
          <Link to="/design-system">
            The details <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}
