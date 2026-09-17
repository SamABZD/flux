import { Link } from 'react-router';
import { GearSix, ArrowUpRight, SignOut } from '@phosphor-icons/react';
import { ResponsiveDialog } from '@/design-system/modal';
import { Avatar } from '@/design-system/avatar';
import { Badge } from '@/design-system/badge';

export function ProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Your profile"
      description="A preview identity for exploring Flux."
    >
      <div className="profile-summary">
        <Avatar name="Alex Morgan" size="large" />
        <div>
          <h3>Alex Morgan</h3>
          <p>demo@flux.example</p>
          <Badge>Demo profile</Badge>
        </div>
      </div>
      <nav className="search-results" aria-label="Profile actions">
        <Link to="/settings" onClick={() => onOpenChange(false)}>
          <GearSix size={20} aria-hidden="true" />
          <span>Settings</span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
        <Link to="/login" onClick={() => onOpenChange(false)}>
          <SignOut size={20} aria-hidden="true" />
          <span>Go to sign in</span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </nav>
    </ResponsiveDialog>
  );
}
