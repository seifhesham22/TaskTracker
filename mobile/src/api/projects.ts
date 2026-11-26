import { PROJECT_FIELDS, type ProjectNode } from './boards';
import { graphqlRequest } from './graphql';

/**
 * Creates a project owned by the signed-in user: the backend takes the owner from the token, makes
 * the key from the name, and saves the project, the Owner membership and a first board together.
 */
export const CREATE_PROJECT_MUTATION = `
  mutation CreateProject($input: CreateProjectInput!) {
    createProject(input: $input) {
      ${PROJECT_FIELDS}
    }
  }
`;

export async function createProjectRequest(name: string): Promise<ProjectNode> {
  const data = await graphqlRequest<{ createProject: ProjectNode }>(CREATE_PROJECT_MUTATION, { input: { name } });
  return data.createProject;
}
