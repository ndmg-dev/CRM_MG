import { Card, CardContent, CardHeader, CardTitle } from "@suporte/components/ui/card";
import { Badge } from "@suporte/components/ui/badge";
import { ListTodo, User } from "lucide-react";

interface KanbanTaskCardProps {
  task: any;
  columnId: string;
  isDragging: boolean;
  onClick: () => void;
}

export const KanbanTaskCard = ({
  task,
  columnId,
  isDragging,
  onClick,
}: KanbanTaskCardProps) => {
  const isCompleted = task.status === "completed";

  return (
    <div onClick={onClick}>
      <Card
        className={`cursor-pointer transition-all border-l-4 border-l-purple-500 ${
          isDragging ? "shadow-lg ring-2 ring-purple-500/30 rotate-2" : "hover:border-purple-400"
        } ${isCompleted ? "opacity-75 hover:opacity-100" : ""}`}
      >
        <CardHeader className="p-4 pb-2">
          <div className="flex justify-between items-start">
            <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/30">
              <ListTodo className="h-3 w-3 mr-1" />
              Rotina
            </Badge>
          </div>
          <CardTitle className={`text-sm mt-2 ${isCompleted ? "line-through text-muted-foreground" : ""}`}>
            {task.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {task.assignee?.full_name || "Sem responsável"}
            </span>
            {task.assignee?.full_name && (
              <div className="h-6 w-6 rounded-full bg-purple-500/20 flex items-center justify-center text-[10px] text-purple-400 font-bold">
                {task.assignee.full_name.charAt(0)}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

