using HotChocolate.Data.Filters;
using TaskTracker.API.Domain.Entities;

namespace TaskTracker.API.Shared.Filtering
{
    public sealed class AssigneeFilterInputType : FilterInputType<TaskAssignee>
    {
        protected override void Configure(IFilterInputTypeDescriptor<TaskAssignee> descriptor)
        {
            descriptor.Name("AssigneeFilterInput");
            descriptor.BindFieldsExplicitly();

            descriptor.Field(a => a.UserId).Type<IdOperationFilterInputType>();
        }
    }
}
