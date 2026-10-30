namespace TaskTracker.API.Shared.GraphQL
{
    [QueryType]
    public class PingQuery
    {
        public string Ping() => "Pong";
    }
}