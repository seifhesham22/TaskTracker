using HotChocolate.Data.Filters;

namespace TaskTracker.API.Features.Tasks.GetBacklog
{
    public sealed class IdOperationFilterInputType : ComparableOperationFilterInputType<UuidType>
    {
        protected override void Configure(IFilterInputTypeDescriptor descriptor)
        {
            descriptor.Name("IdOperationFilterInput");
            descriptor.Operation(DefaultFilterOperations.Equals).Type<UuidType>();
            descriptor.Operation(DefaultFilterOperations.NotEquals).Type<UuidType>();
            descriptor.Operation(DefaultFilterOperations.In).Type<ListType<UuidType>>();
            descriptor.Operation(DefaultFilterOperations.NotIn).Type<ListType<UuidType>>();
            descriptor.AllowAnd(false).AllowOr(false);
        }
    }
}
