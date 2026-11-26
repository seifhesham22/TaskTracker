import { graphqlRequest } from './graphql';

const MEMBER_FIELDS = `
      projectId
      userId
      userName
      role
`;

export const ADD_PROJECT_MEMBER_MUTATION = `
  mutation AddProjectMember($input: AddProjectMemberInput!) {
    addProjectMember(input: $input) {
      ${MEMBER_FIELDS}
    }
  }
`;

export const REMOVE_PROJECT_MEMBER_MUTATION = `
  mutation RemoveProjectMember($input: RemoveProjectMemberInput!) {
    removeProjectMember(input: $input) {
      ${MEMBER_FIELDS}
    }
  }
`;

export interface ProjectMemberNode {
  projectId: string;
  userId: string;
  userName: string;
  role: string;
}

/** Adds the registered account with exactly this email. */
export async function addProjectMemberRequest(projectId: string, email: string, role: string): Promise<ProjectMemberNode> {
  const data = await graphqlRequest<{ addProjectMember: ProjectMemberNode }>(ADD_PROJECT_MEMBER_MUTATION, {
    input: { projectId, email, role },
  });
  return data.addProjectMember;
}

export async function removeProjectMemberRequest(projectId: string, userId: string): Promise<void> {
  await graphqlRequest<{ removeProjectMember: ProjectMemberNode }>(REMOVE_PROJECT_MEMBER_MUTATION, {
    input: { projectId, userId },
  });
}
