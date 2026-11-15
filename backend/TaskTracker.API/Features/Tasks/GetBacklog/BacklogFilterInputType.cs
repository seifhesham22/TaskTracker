using HotChocolate.Data.Filters;
using TaskTracker.API.Domain.Entities;

namespace TaskTracker.API.Features.Tasks.GetBacklog
{
    public sealed class BacklogFilterInputType : FilterInputType<TaskItem>
    {
        protected override void Configure(IFilterInputTypeDescriptor<TaskItem> descriptor)
        {
            descriptor.Name("BacklogFilterInput");
            descriptor.BindFieldsExplicitly();

            descriptor.Field(t => t.Column.Category).Name("status");
            descriptor.Field(t => t.Priority);
            descriptor.Field(t => t.BoardId).Type<IdOperationFilterInputType>();
            descriptor.Field(t => t.ParentTaskId).Type<IdOperationFilterInputType>();
        }
    }
}
