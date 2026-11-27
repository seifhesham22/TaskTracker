import { useLocalSearchParams } from 'expo-router';

import { WorkloadTaskList } from '../../../../../components/workload/WorkloadTaskList';

/** US-29: one member's open tasks in the project. */
export default function MemberWorkloadScreen() {
  const { projectId, userId } = useLocalSearchParams<{ projectId: string; userId: string }>();
  return <WorkloadTaskList projectId={projectId} group={{ kind: 'member', userId: userId ?? '' }} />;
}
