// src/app/_components/Form/index.tsx (正しいはずの完全なコード)
// Input, AnimatePresence, Reorder, Diff は SortableList.tsx に移動したのでコメントアウトまたは削除
// import { Input } from "@/components/ui/input";
import type { TeamScore } from "@/types";
// import { AnimatePresence, Reorder } from "framer-motion";
// import { Diff } from "lucide-react";
import { type Dispatch, type SetStateAction, useEffect, useRef } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import dynamic from "next/dynamic"; // dynamic をインポート

// SortableList を動的にインポート
const SortableList = dynamic(() => import("./SortableList"), {
  ssr: false, // サーバーサイドレンダリングを無効化
  loading: () => <div className="text-center p-4">Loading scores...</div>, // ローディング中の表示
});

type FormProps = {
  teamScoreList: TeamScore[];
  setTeamScoreList: Dispatch<SetStateAction<TeamScore[]>>;
  lastScreenshot: string | null; // ★ 追加
};

type FormValues = {
  results: TeamScore[];
};

export const Form = ({ teamScoreList, setTeamScoreList, lastScreenshot }: FormProps) => { // ★ lastScreenshot を受け取る
  const { register, handleSubmit, control, reset, setValue } =
    useForm<FormValues>({
      defaultValues: {
        results: teamScoreList.sort((a, b) => b.score - a.score),
      },
    });

  const { fields } = useFieldArray({
    control,
    name: "results",
  });

  // 外部のteamScoreList更新に対する反映フラグ
  const isUpdatingFromTeamScoreList = useRef(false);

  // teamScoreListが変更された時にフォームをリセットして更新
  useEffect(() => {
    if (!isUpdatingFromTeamScoreList.current) {
      reset({
        results: teamScoreList.sort((a, b) => b.score - a.score),
      });
    }
    isUpdatingFromTeamScoreList.current = false;
  }, [teamScoreList, reset]);

  const onSubmit = (data: FormValues) => {
    console.info("フォーム送信:", data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="pt-16"> {/* 上部のボタンが隠れないようにパディングを追加 */}
      {/* オーバーレイコンテナ */}      <div
        className="
          w-fit mx-auto flex flex-col gap-2 {/* ml-auto から mx-auto に変更して中央揃え */}
          font-sans
          text-white
          mt-4 {/* 上部にさらに余白を追加 */}
        "
      >
        {/* SortableListコンポーネントを呼び出し */}
        {fields && fields.length > 0 ? (
          <SortableList
            fields={fields}
            control={control}
            register={register}
            setValue={setValue}
            setTeamScoreList={setTeamScoreList}
          />
        ) : (
          <div className="text-center p-4">No scores to display.</div>
        )}
      </div> {/* このdivは59行目のdivの閉じタグ */}
    </form>
  );
};
