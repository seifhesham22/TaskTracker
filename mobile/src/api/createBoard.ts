import type { ColumnNode } from './boards';
import { graphqlRequest } from './graphql';

/**
 * US-7: the backend's `createBoard` (CreateBoardHandler). It takes the Owner from the token, trims
 * and checks the name, refuses a name already used in the same project (in any case), and creates
 * the board with its default columns. The app sends only the project and the name.
 */
export const CREATE_BOARD_MUTATION = `
  mutation CreateBoard($input: CreateBoardInput!) {
    createBoard(input: $input) {
      id
      projectId
      name
      columns {
        id
        name
        position
        category
      }
    }
  }
`;

export interface CreatedBoardNode {
  id: string;
  projectId: string;
  name: string;
  columns: ColumnNode[];
}

export async function createBoardRequest(projectId: string, name: string): Promise<CreatedBoardNode> {
  const data = await graphqlRequest<{ createBoard: CreatedBoardNode }>(CREATE_BOARD_MUTATION, {
    input: { projectId, name },
  });
  return data.createBoard;
}
