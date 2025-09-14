using DashboardFunctions.Domain;

namespace DashboardFunctions.Services
{
    internal sealed class RangeService : IRangeService
    {
        public IReadOnlyList<DateRange> Coalesce(IEnumerable<DateRange> ranges)
        {
            var list = ranges.Select(r => r.Normalize()).Where(r => !r.IsEmpty).OrderBy(r => r.Start).ToList();
            if (list.Count == 0) return list;

            var stack = new Stack<DateRange>();
            stack.Push(list[0]);
            for (var i = 1; i < list.Count; i++)
            {
                var top = stack.Peek();
                var cur = list[i];
                if (cur.Start <= top.End.AddDays(1)) // overlap or adjacent
                {
                    var merged = new DateRange(top.Start, cur.End > top.End ? cur.End : top.End);
                    stack.Pop();
                    stack.Push(merged);
                }
                else
                {
                    stack.Push(cur);
                }
            }
            return stack.Reverse().ToList();
        }

        public IReadOnlyList<DateRange> Complement(DateRange target, IEnumerable<DateRange> covered)
        {
            var cov = Coalesce(covered.Select(c => c.Intersect(target)).Where(c => !c.IsEmpty));
            var gaps = new List<DateRange>();
            var cursor = target.Start;

            foreach (var c in cov)
            {
                if (cursor < c.Start)
                    gaps.Add(new DateRange(cursor, c.Start.AddDays(-1)));
                cursor = c.End.AddDays(1);
            }
            if (cursor <= target.End)
                gaps.Add(new DateRange(cursor, target.End));
            return gaps;
        }
    }

}
