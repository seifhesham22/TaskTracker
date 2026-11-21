using HotChocolate.Data.Filters;
using TaskTracker.API.Domain.Entities;

namespace TaskTracker.API.Shared.Filtering
{
    public abstract class TaskFilterInputTypeBase(string name) : FilterInputType<TaskItem>
    {
        protected override void Configure(IFilterInputTypeDescriptor<TaskItem> descriptor)
        {
            descriptor.Name(name);
            descriptor.BindFieldsExplicitly();

            descriptor.Field(t => t.Column.Category).Name("status");
            descriptor.Field(t => t.Priority);
            descriptor.Field(t => t.BoardId).Type<IdOperationFilterInputType>();
            descriptor.Field(t => t.ParentTaskId).Type<IdOperationFilterInputType>();
            descriptor.Field(t => t.Assignees).Type<ListFilterInputType<AssigneeFilterInputType>>();
        }
    }
}
