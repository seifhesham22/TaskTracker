import { useLocalSearchParams } from 'expo-router';

import { WorkloadTaskList } from '../../../../components/workload/WorkloadTaskList';

/** US-29: the project's open tasks that no current member is assigned to. */
export default function UnassignedWorkScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  return <WorkloadTaskList projectId={projectId} group={{ kind: 'unassigned' }} />;
}
