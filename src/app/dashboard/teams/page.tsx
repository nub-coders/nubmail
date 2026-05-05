'use client';

import { useEffect, useState } from 'react';
import { Users, Plus, Trash2, UserPlus, Crown, Shield, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuthClient } from '@/lib/auth-provider';
import { useToast } from '@/hooks/use-toast';

interface Team {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  memberCount: number;
}

interface Member {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  email: string;
  fullName: string | null;
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  owner: <Crown className="h-3 w-3" />,
  admin: <Shield className="h-3 w-3" />,
  member: <User className="h-3 w-3" />,
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-500/10 text-amber-600',
  admin: 'bg-blue-500/10 text-blue-600',
  member: 'bg-gray-500/10 text-gray-600',
};

export default function TeamsPage() {
  const { user , token} = useAuthClient();
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [creating, setCreating] = useState(false);

  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, Member[]>>({});
  const [membersLoading, setMembersLoading] = useState<string | null>(null);

  const [addMemberEmail, setAddMemberEmail] = useState('');
  const [addingMember, setAddingMember] = useState(false);


  const fetchTeams = async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/teams', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setTeams(data.teams || []);
    } catch {} finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchTeams();
  }, [user]);

  const fetchMembers = async (teamId: string) => {
    setMembersLoading(teamId);
    try {
      const res = await fetch(`/api/teams/members?teamId=${teamId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setMembers(prev => ({ ...prev, [teamId]: data.members || [] }));
    } catch {} finally {
      setMembersLoading(null);
    }
  };

  const toggleExpand = (teamId: string) => {
    if (expandedTeam === teamId) {
      setExpandedTeam(null);
    } else {
      setExpandedTeam(teamId);
      if (!members[teamId]) fetchMembers(teamId);
    }
  };

  const handleCreate = async () => {
    if (!teamName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: teamName.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTeams(prev => [data.team, ...prev]);
      setTeamName('');
      setCreateOpen(false);
      toast({ title: 'Created', description: `Team "${data.team.name}" created` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to create team', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    try {
      const res = await fetch(`/api/teams?id=${teamId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setTeams(prev => prev.filter(t => t.id !== teamId));
      toast({ title: 'Deleted', description: 'Team deleted' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to delete team', variant: 'destructive' });
    }
  };

  const handleAddMember = async (teamId: string) => {
    if (!addMemberEmail.trim()) return;
    setAddingMember(true);
    try {
      const res = await fetch('/api/teams/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ teamId, email: addMemberEmail.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMembers(prev => ({
        ...prev,
        [teamId]: [...(prev[teamId] || []), data.member]
      }));
      setTeams(prev => prev.map(t => t.id === teamId ? { ...t, memberCount: t.memberCount + 1 } : t));
      setAddMemberEmail('');
      toast({ title: 'Added', description: `Member added to team` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to add member', variant: 'destructive' });
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (teamId: string, userId: string) => {
    try {
      const res = await fetch(`/api/teams/members?teamId=${teamId}&userId=${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setMembers(prev => ({
        ...prev,
        [teamId]: (prev[teamId] || []).filter(m => m.userId !== userId)
      }));
      setTeams(prev => prev.map(t => t.id === teamId ? { ...t, memberCount: Math.max(0, t.memberCount - 1) } : t));
      toast({ title: 'Removed', description: 'Member removed from team' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to remove member', variant: 'destructive' });
    }
  };

  if (!user) {
    return <div className="py-8 text-center">You must be signed in to manage teams.</div>;
  }

  if (isLoading) {
    return (
      <div className="py-12">
        <LoadingSpinner size="md" text="Loading teams..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Teams</h1>
          <p className="text-sm text-muted-foreground">
            {teams.length === 0 ? 'Create a team to collaborate' : `${teams.length} team${teams.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Team</DialogTitle>
              <DialogDescription>Create a new team and invite members to collaborate.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="team-name">Team Name</Label>
                <Input
                  id="team-name"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. Marketing, Engineering"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={creating || !teamName.trim()}>
                {creating ? 'Creating...' : 'Create Team'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {teams.length === 0 && (
        <EmptyState
          icon={<Users className="h-16 w-16" />}
          title="No Teams Yet"
          description="Create a team to collaborate with others on shared email domains and accounts."
          action={{ label: 'Create Team', onClick: () => setCreateOpen(true) }}
        />
      )}

      {teams.map((team) => {
        const isOwner = team.ownerId === user.id;
        const isExpanded = expandedTeam === team.id;
        const teamMembers = members[team.id] || [];

        return (
          <Card key={team.id}>
            <CardHeader className="cursor-pointer" onClick={() => toggleExpand(team.id)}>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{team.name}</CardTitle>
                  <CardDescription>
                    {team.memberCount} member{team.memberCount !== 1 ? 's' : ''}
                    {isOwner && ' · You own this team'}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {isOwner && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="hover:bg-destructive/10" onClick={(e) => e.stopPropagation()}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete team "{team.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>This will remove the team and all memberships. This action cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteTeam(team.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0 space-y-4">
                {membersLoading === team.id ? (
                  <div className="py-4"><LoadingSpinner size="sm" text="Loading members..." /></div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {teamMembers.map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-medium text-primary">
                                {(member.fullName || member.email).charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium">{member.fullName || member.email}</p>
                              {member.fullName && <p className="text-xs text-muted-foreground">{member.email}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className={ROLE_COLORS[member.role] || ROLE_COLORS.member}>
                              {ROLE_ICONS[member.role]}
                              <span className="ml-1 capitalize">{member.role}</span>
                            </Badge>
                            {isOwner && member.role !== 'owner' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 hover:bg-destructive/10"
                                onClick={() => handleRemoveMember(team.id, member.userId)}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {isOwner && (
                      <div className="flex items-end gap-2 pt-2 border-t">
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">Add member by email</Label>
                          <Input
                            value={addMemberEmail}
                            onChange={(e) => setAddMemberEmail(e.target.value)}
                            placeholder="user@example.com"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddMember(team.id)}
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleAddMember(team.id)}
                          disabled={addingMember || !addMemberEmail.trim()}
                        >
                          <UserPlus className="h-4 w-4 mr-1" />
                          {addingMember ? 'Adding...' : 'Add'}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
