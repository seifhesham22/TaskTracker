import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ProjectRole, type ProjectMember } from '../domain/models';
import { useProjectMembers } from '../hooks/useProjectMembers';
import { AddMemberModal } from '../components/project/AddMemberModal';
import { RemoveMemberModal } from '../components/project/RemoveMemberModal';
import './ProjectMembersPage.css';

function formatRoleLabel(role: ProjectRole): string {
  switch (role) {
    case ProjectRole.Owner:
      return 'Owner';
    case ProjectRole.Writer:
      return 'Writer';
    case ProjectRole.Reader:
      return 'Reader';
    default:
      return role;
  }
}

export function ProjectMembersPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const {
    project,
    members,
    isLoading,
    error,
    isOwner,
    currentUserId,
    lastOwnerId,
    addMember,
    removeMember,
    reload,
  } = useProjectMembers(projectId);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<ProjectMember | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const projectName = project?.name || 'Project';
  const roleViewLabel = useMemo(() => {
    if (!project?.role) return 'Member view';
    const normalized = project.role.toUpperCase();
    if (normalized === ProjectRole.Owner) return 'Owner view';
    if (normalized === ProjectRole.Writer) return 'Writer view';
    if (normalized === ProjectRole.Reader) return 'Reader view';
    return `${project.role} view`;
  }, [project?.role]);

  const handleOpenAddModal = () => {
    setStatusBanner(null);
    setIsAddModalOpen(true);
  };

  const handleOpenRemoveModal = (member: ProjectMember) => {
    setStatusBanner(null);
    setMemberToRemove(member);
  };

  return (
    <div className="project-members-page">
      <nav className="project-members-breadcrumbs" aria-label="Breadcrumb">
        <Link to="/projects" className="project-members-breadcrumb-link">
          Projects
        </Link>
        <span className="project-members-breadcrumb-separator">/</span>
        <span className="project-members-breadcrumb-current">Manage project members</span>
      </nav>

      {statusBanner && (
        <div
          className="project-members-banner"
          role="status"
          data-testid="project-members-status-banner"
        >
          <p>{statusBanner}</p>
        </div>
      )}

      {isLoading && (
        <div className="project-members-loading" role="status">
          <span>Loading project members…</span>
        </div>
      )}

      {error && !isLoading && (
        <div className="project-members-error-state" role="alert">
          <p>{error}</p>
          <button type="button" className="project-members-retry-btn" onClick={reload}>
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && (
        <section className="project-members-card" aria-labelledby="project-members-heading">
          <header className="project-members-header">
            <h1 id="project-members-heading" className="project-members-title">
              Project members
            </h1>
            <p className="project-members-subtitle">
              {projectName} · {roleViewLabel}
            </p>
          </header>

          <ul className="project-members-list" aria-label="Members list">
            {members.map((member) => {
              const isCurrentUser = member.userId === currentUserId;
              const isLastOwner = member.userId === lastOwnerId;
              const roleDisplay =
                member.role === ProjectRole.Owner && isLastOwner
                  ? 'Owner · Last Owner'
                  : formatRoleLabel(member.role);

              return (
                <li
                  key={member.userId}
                  className="project-member-item"
                  data-testid={`project-member-item-${member.userId}`}
                >
                  <div className="project-member-item-info">
                    <strong className="project-member-item-name">
                      {member.userName} {isCurrentUser && '(you)'}
                    </strong>
                    <span className="project-member-item-role">{roleDisplay}</span>
                  </div>

                  {isOwner && !isLastOwner && (
                    <button
                      type="button"
                      className="project-member-remove-btn"
                      onClick={() => handleOpenRemoveModal(member)}
                      data-testid={`remove-member-btn-${member.userId}`}
                    >
                      Remove
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          {isOwner ? (
            <button
              type="button"
              className="project-members-add-btn"
              onClick={handleOpenAddModal}
              data-testid="add-member-open-btn"
            >
              Add member
            </button>
          ) : (
            <p className="project-members-restricted-notice">
              Only an Owner can add or remove members.
            </p>
          )}
        </section>
      )}

      <AddMemberModal
        isOpen={isAddModalOpen}
        projectName={projectName}
        existingMembers={members}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={addMember}
        onSuccess={(created) => {
          setStatusBanner(`✓ ${created.userName} added as a ${formatRoleLabel(created.role)}.`);
        }}
      />

      <RemoveMemberModal
        isOpen={Boolean(memberToRemove)}
        projectName={projectName}
        targetMember={memberToRemove}
        isLastOwner={memberToRemove ? memberToRemove.userId === lastOwnerId : false}
        onClose={() => setMemberToRemove(null)}
        onConfirm={async (userId) => {
          await removeMember(userId);
        }}
        onSuccess={(removed) => {
          setStatusBanner(`✓ ${removed.userName} removed. Project access revoked.`);
        }}
      />
    </div>
  );
}
