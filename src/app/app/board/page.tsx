import { Suspense } from "react";
import { AppPageHeader } from "@/components/app/page-header";
import { BoardApp } from "@/components/app/board/board-app";
import { TemplatedToast } from "@/components/app/templated-toast";

export default function BoardPage() {
  return (
    <>
      <AppPageHeader />
      <BoardApp />
      <Suspense fallback={null}>
        <TemplatedToast />
      </Suspense>
    </>
  );
}
