"use client";

/**
 * 管理员后台：全站汇总 + 用户管理。
 * 统计与用户管理接口尚未实现，当前全部使用 lib/demo-data.ts 中的虚构数据；
 * 按需求，管理员不查看他人简历内容、私人备注或完整分享链接。
 */
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Ban, Eye, FileText, Info, Link2, MoreHorizontal, RotateCcw, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { type AdminUser, adminSummary, adminUsers, adminVisitTrend } from "@/lib/demo-data";
import { PageHeader } from "@/components/workspace/page-header";

const number = new Intl.NumberFormat("zh-CN");
const date = (value: string) => new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
const dateTime = (value: string) => new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));

const chartConfig = {
  landing: { label: "首页访问", color: "var(--chart-3)" },
  share: { label: "分享页访问", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function AdminDashboard() {
  return <div>
    <PageHeader title="管理后台" description="查看全站使用情况，管理注册用户"
      badge={<Badge variant="outline" className="border-warning/40 bg-warning/10 font-normal text-warning">示例数据</Badge>}
      actions={<p className="text-xs text-muted-foreground">更新于 {dateTime(adminSummary.updatedAt)}</p>} />

    <div className="mt-8 flex gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm leading-relaxed">
      <Info className="mt-0.5 size-4 shrink-0 text-warning" />
      <p>统计与用户管理接口尚未接入，本页展示的是虚构数据，仅用于确认界面。管理员不会看到他人的简历内容、私人备注或完整分享链接。</p>
    </div>

    <Tabs defaultValue="overview" className="mt-6">
      <TabsList className="h-10">
        <TabsTrigger value="overview" className="px-4">概览</TabsTrigger>
        <TabsTrigger value="users" className="px-4">用户管理</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="mt-6 min-w-0"><Overview /></TabsContent>
      <TabsContent value="users" className="mt-6 min-w-0"><UserTable /></TabsContent>
    </Tabs>
  </div>;
}

function Overview() {
  const { shares } = adminSummary;
  const segments = [
    { key: "active", label: "生效", value: shares.active, className: "bg-primary" },
    { key: "expired", label: "已过期", value: shares.expired, className: "bg-chart-3" },
    { key: "inactive", label: "已停用", value: shares.inactive, className: "bg-muted-foreground/40" },
  ];

  return <div className="grid grid-cols-1 gap-6">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Stat icon={Users} label="注册用户" value={adminSummary.users} hint={`近 7 天新增 ${adminSummary.newUsers7d}`} />
      <Stat icon={FileText} label="简历数量" value={adminSummary.resumes} hint={`占用存储 ${number.format(adminSummary.storageMb)} MB`} />
      <Stat icon={Link2} label="分享链接" value={shares.total} hint={`生效中 ${shares.active}`} />
      <Stat icon={Eye} label="分享页访问" value={adminSummary.visits.share} hint={`首页访问 ${number.format(adminSummary.visits.landing)}`} />
    </div>

    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>近 7 天访问</CardTitle>
          <CardDescription>首页与分享页分别计数；PDF 分页请求、下载和状态检查不计入</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[260px] w-full">
            <BarChart data={adminVisitTrend} margin={{ left: 0, right: 4 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} width={40} />
              <ChartTooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="landing" fill="var(--color-landing)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="share" fill="var(--color-share)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>分享状态</CardTitle>
          <CardDescription>全站 {number.format(shares.total)} 条分享链接</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={segments.map((item) => `${item.label} ${item.value}`).join("，")}>
            {segments.map((item) => <div key={item.key} className={item.className} style={{ width: `${(item.value / shares.total) * 100}%` }} />)}
          </div>
          <ul className="grid gap-3">
            {segments.map((item) => <li key={item.key} className="flex items-center gap-3 text-sm">
              <span className={`size-2.5 rounded-full ${item.className}`} />
              <span className="flex-1 text-muted-foreground">{item.label}</span>
              <span className="font-medium tabular-nums">{number.format(item.value)}</span>
              <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">{Math.round((item.value / shares.total) * 100)}%</span>
            </li>)}
          </ul>
          <p className="border-t pt-4 text-xs leading-relaxed text-muted-foreground">访问次数不等于阅读人数，刷新和链接预览工具可能产生重复计数，数据可能有延迟</p>
        </CardContent>
      </Card>
    </div>
  </div>;
}

function Stat({ icon: Icon, label, value, hint }: { icon: typeof Users; label: string; value: number; hint: string }) {
  return <Card className="gap-3 py-5">
    <CardHeader className="flex items-center justify-between px-5">
      <CardDescription className="font-medium text-muted-foreground">{label}</CardDescription>
      <span className="grid size-8 place-items-center rounded-md bg-secondary text-primary"><Icon className="size-4" /></span>
    </CardHeader>
    <CardContent className="px-5">
      <p className="text-[28px] leading-none font-bold tabular-nums">{number.format(value)}</p>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </CardContent>
  </Card>;
}

type Filter = "all" | AdminUser["status"];

function UserTable() {
  const [users, setUsers] = useState(adminUsers);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return users.filter((user) => (filter === "all" || user.status === filter)
      && (!keyword || user.name.toLowerCase().includes(keyword) || user.email.toLowerCase().includes(keyword)));
  }, [users, query, filter]);

  function toggle(user: AdminUser) {
    const status = user.status === "active" ? "suspended" : "active";
    setUsers((current) => current.map((item) => item.id === user.id ? { ...item, status } : item));
    toast.success(status === "suspended" ? `已停用 ${user.name}` : `已恢复 ${user.name}`, { description: "示例数据，未实际生效" });
  }

  return <Card className="gap-0 py-0">
    <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative sm:w-72">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="h-10 pl-9" placeholder="搜索昵称或邮箱" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="搜索用户" />
      </div>
      <ToggleGroup type="single" variant="outline" value={filter} onValueChange={(value) => value && setFilter(value as Filter)} aria-label="按状态筛选">
        <ToggleGroupItem value="all" className="h-10 px-4">全部</ToggleGroupItem>
        <ToggleGroupItem value="active" className="h-10 px-4">正常</ToggleGroupItem>
        <ToggleGroupItem value="suspended" className="h-10 px-4">已停用</ToggleGroupItem>
      </ToggleGroup>
    </div>

    <Table>
      <TableHeader>
        <TableRow className="bg-muted/50 hover:bg-muted/50">
          <TableHead className="pl-4">用户</TableHead>
          <TableHead>注册时间</TableHead>
          <TableHead>最近活跃</TableHead>
          <TableHead className="text-right">简历</TableHead>
          <TableHead className="text-right">分享</TableHead>
          <TableHead>状态</TableHead>
          <TableHead className="w-12 pr-4"><span className="sr-only">操作</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {visible.length === 0 ? <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">没有符合条件的用户</TableCell></TableRow>
          : visible.map((user) => <TableRow key={user.id}>
            <TableCell className="pl-4">
              <div className="flex items-center gap-3">
                <Avatar className="size-8"><AvatarFallback className="bg-secondary text-xs text-secondary-foreground">{user.name.slice(0, 1)}</AvatarFallback></Avatar>
                <div className="min-w-0"><p className="font-medium">{user.name}</p><p className="text-xs text-muted-foreground">{user.email}</p></div>
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground tabular-nums">{date(user.createdAt)}</TableCell>
            <TableCell className="text-muted-foreground tabular-nums">{dateTime(user.lastActiveAt)}</TableCell>
            <TableCell className="text-right tabular-nums">{user.resumes}</TableCell>
            <TableCell className="text-right tabular-nums">{user.shares}</TableCell>
            <TableCell>{user.status === "active"
              ? <Badge variant="outline" className="border-success/30 bg-success/10 text-success">正常</Badge>
              : <Badge variant="outline" className="bg-muted text-muted-foreground">已停用</Badge>}</TableCell>
            <TableCell className="pr-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`${user.name} 的操作`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {user.status === "active"
                    ? <DropdownMenuItem variant="destructive" onSelect={() => toggle(user)}><Ban />停用账号</DropdownMenuItem>
                    : <DropdownMenuItem onSelect={() => toggle(user)}><RotateCcw />恢复账号</DropdownMenuItem>}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>)}
      </TableBody>
    </Table>
    <div className="border-t px-4 py-3 text-xs text-muted-foreground">共 {visible.length} 位用户</div>
  </Card>;
}
