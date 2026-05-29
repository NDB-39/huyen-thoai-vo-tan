import { useState } from "react";
import { GameMode, GameSettings } from "../types";
import { motion } from "motion/react";
import { Settings, RefreshCw, ChevronRight, BookOpen, Focus, Combine } from "lucide-react";
import { Dialog } from "./Dialog";

interface SetupScreenProps {
  onStart: (systemPrompt: string, mode: GameMode) => void;
  settings: GameSettings;
  updateSettings: (s: GameSettings) => void;
}

const MODES = [
  {
    id: "game" as GameMode,
    title: "Trò Chơi (Game)",
    desc: "Thử thách sinh tồn, logic nhân quả mạnh. Bạn cần quyết định cẩn thận.",
    icon: Focus,
  },
  {
    id: "story" as GameMode,
    title: "Cốt Truyện (Story)",
    desc: "Khám phá thế giới, văn phong bay bổng mượt mà, ít áp lực.",
    icon: BookOpen,
  },
  {
    id: "hybrid" as GameMode,
    title: "Game & Truyện",
    desc: "Kết hợp giữa tương tác thử thách và kể chuyện tự do sâu sắc.",
    icon: Combine,
  }
];

export function SetupScreen({ onStart, settings, updateSettings }: SetupScreenProps) {
  const [step, setStep] = useState<"mode" | "scenario">("mode");
  const [selectedMode, setSelectedMode] = useState<GameMode>("hybrid");
  const [scenarios, setScenarios] = useState<string[]>([]);
  const [isLoadingScenarios, setIsLoadingScenarios] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const tempSettings = { ...settings };
  const [textListStr, setTextListStr] = useState(settings.textModelsList.join(", "));
  const [imageListStr, setImageListStr] = useState(settings.imageModelsList.join(", "));
  const [txtModel, setTxtModel] = useState(settings.currentTextModel);
  const [imgModel, setImgModel] = useState(settings.currentImageModel);
  const [imgRatio, setImgRatio] = useState(settings.imageRatio || "16:9");

  const generateScenarios = async (mode: GameMode) => {
    setIsLoadingScenarios(true);
    setStep("scenario");
    try {
      const modePrompt = mode === "game" ? "khắc nghiệt, nhiều thử thách" : (mode === "story" ? "phong phú, chú trọng kể chuyện" : "kết hợp thử thách và cốt truyện nhập vai");
      const prompt = `Hãy đề xuất ngắn gọn 3 hướng kịch bản khởi đầu khác nhau (khoảng 30 chữ mỗi hướng) cho một thế giới phiêu lưu văn bản (${modePrompt}). Trả về dưới định dạng Markdown list (mỗi mục bắt đầu bằng "- ").`;
      
      const res = await fetch('https://pollinations-proxy.spritenguyen.workers.dev/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: settings.currentTextModel || "openai",
          messages: [{ role: "user", content: prompt }]
        })
      });
      const data = await res.json();
      const content = data.choices[0].message.content;
      
      // Parse markdown lists
      const lines = content.split('\n').filter((l: string) => l.trim().startsWith('-'));
      const parsedScenarios = lines.map((l: string) => l.replace(/^-\s*/, '').trim()).filter(Boolean);
      
      if (parsedScenarios.length > 0) {
        setScenarios(parsedScenarios.slice(0, 3));
      } else {
        setScenarios(["Thức tỉnh trong một khu rừng kỳ lạ với ký ức trống rỗng.", "Một hiệp sĩ đơn độc trên đường tìm kiếm thanh kiếm ánh sáng.", "Mắc kẹt trên một trạm không gian bỏ hoang bên rìa dải ngân hà."]);
      }
    } catch (e) {
      setScenarios([
        "Bạn tỉnh dậy tại một vương quốc sụp đổ, xung quanh chỉ còn tro tàn.",
        "Một chuyến du hành vượt thời gian bị lỗi, bạn rớt xuống thời trung cổ.",
        "Trường học phép thuật đột nhiên bị quái vật tấn công trong đêm."
      ]);
    } finally {
      setIsLoadingScenarios(false);
    }
  };

  const handleModeSelect = (mode: GameMode) => {
    setSelectedMode(mode);
    generateScenarios(mode);
  };

  const startGameWithScenario = (scenario: string) => {
    let modeDesc = "";
    if (selectedMode === "game") modeDesc = "Trò chơi ưu tiên logic, quyết định có tính sống còn, thử thách cao. Nếu gặp lệnh /next, tự động phát sinh tình huống phải giải quyết.";
    else if (selectedMode === "story") modeDesc = "Chú trọng văn phong, miêu tả cảnh vật chi tiết. Nếu gặp lệnh /next, kể tiếp câu chuyện nhẹ nhàng mượt mà.";
    else modeDesc = "Cân bằng giữa tạo thử thách và miêu tả văn học sâu sắc. Khuyến khích nhập vai. Nếu gặp lệnh /next, đẩy mạch truyện lên cao trào mới.";

    const systemPrompt = `Bạn là người quản trò của một cuộc phiêu lưu văn bản. Người chơi là nhân vật chính. Chế độ hiện tại: ${modeDesc}. 
Bối cảnh khởi phát: "${scenario}".
Quy tắc:
1. Thông dịch lệnh của người chơi thành hành động thực tế trong game.
2. Nếu người chơi nhập "/next", hãy tiến tới khung cảnh kế tiếp một cách mượt mà và logic.
3. Không lặp lại văn bản của hệ thống, luôn đưa ra tình huống đễ mở cho người chơi tham gia. Trả lời bằng tiếng Việt.`;

    onStart(systemPrompt, selectedMode);
  };

  const saveSettings = () => {
    const newTextList = textListStr.split(',').map(s => s.trim()).filter(Boolean);
    const newImgList = imageListStr.split(',').map(s => s.trim()).filter(Boolean);
    updateSettings({
      textModelsList: newTextList.length ? newTextList : ['openai', 'mistral', 'mistral-large', 'llama'],
      imageModelsList: newImgList.length ? newImgList : ['flux', 'turbo'],
      currentTextModel: txtModel,
      currentImageModel: imgModel,
      imageRatio: imgRatio
    });
    setShowSettings(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4 py-8">
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
        
        {/* Header */}
        <div className="bg-indigo-600 p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20">
            <BookOpen size={120} className="transform rotate-12 translate-x-8 -translate-y-8" />
          </div>
          <button onClick={() => setShowSettings(true)} className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition">
            <Settings size={24} />
          </button>
          <div className="relative z-10 space-y-2">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-900/20 mb-4">
              <span className="text-indigo-600 font-bold text-3xl">H</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Huyền Thoại Vô Tận</h1>
            <p className="text-indigo-100 font-medium max-w-lg mx-auto">Chọn chế độ và bước vào một thế giới do AI dẫn dắt, được viết riêng cho bạn.</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 md:p-10">
          {step === "mode" ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900 text-center mb-6">Bạn muốn trải nghiệm như thế nào?</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {MODES.map(m => (
                  <button
                    key={m.id}
                    onClick={() => handleModeSelect(m.id)}
                    className="p-6 rounded-2xl border-2 border-gray-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all text-left group"
                  >
                    <m.icon size={32} className="text-indigo-500 mb-4 group-hover:scale-110 transition-transform" />
                    <h3 className="font-bold text-gray-900 mb-2">{m.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{m.desc}</p>
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Các Gợi Ý Kịch Bản</h2>
                <button 
                  onClick={() => generateScenarios(selectedMode)} 
                  disabled={isLoadingScenarios}
                  className="flex items-center space-x-2 text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                >
                  <RefreshCw size={18} className={isLoadingScenarios ? "animate-spin" : ""} />
                  <span className="text-sm font-semibold">Tạo lại</span>
                </button>
              </div>

              {isLoadingScenarios ? (
                <div className="space-y-4 py-8">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-xl" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {scenarios.map((scen, idx) => (
                    <button
                      key={idx}
                      onClick={() => startGameWithScenario(scen)}
                      className="w-full p-5 rounded-xl border border-gray-200 hover:bg-indigo-50 hover:border-indigo-300 transition-all text-left flex items-start justify-between group"
                    >
                      <span className="text-gray-800 font-medium pr-4 leading-relaxed">{scen}</span>
                      <ChevronRight size={20} className="text-gray-400 group-hover:text-indigo-600 shrink-0 mt-1" />
                    </button>
                  ))}

                  <div className="pt-6 mt-6 border-t">
                    <p className="text-sm text-gray-500 font-medium mb-3">Hoặc tự nhập bối cảnh muốn vào vai:</p>
                    <div className="flex gap-2">
                       <input 
                         type="text" 
                         className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 transition"
                         placeholder="Ví dụ: Bạn là mật vụ trên tàu không gian bị kẹt..."
                         onKeyDown={(e) => {
                           if (e.key === 'Enter') startGameWithScenario(e.currentTarget.value);
                         }}
                       />
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      <Dialog isOpen={showSettings} onClose={() => setShowSettings(false)} title="Cài Đặt Mô Hình (Pollinations)">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Danh sách Model Văn Bản (cách nhau dấu phẩy)</label>
            <textarea 
              value={textListStr}
              onChange={e => setTextListStr(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm text-gray-800 font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Model Văn Bản Hiện Tại</label>
            <select 
              value={txtModel} 
              onChange={e => setTxtModel(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm"
            >
              {textListStr.split(',').map(s => s.trim()).filter(Boolean).map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="pt-4 border-t">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Danh sách Model Hình Ảnh (cách nhau dấu phẩy)</label>
            <textarea 
              value={imageListStr}
              onChange={e => setImageListStr(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm text-gray-800 font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Model Hình Hiện Tại</label>
            <select 
              value={imgModel} 
              onChange={e => setImgModel(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm"
            >
              {imageListStr.split(',').map(s => s.trim()).filter(Boolean).map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="pt-4 border-t">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Tỉ lệ Hình Ảnh</label>
            <select 
              value={imgRatio} 
              onChange={e => setImgRatio(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm"
            >
              <option value="16:9">16:9 (Ngang)</option>
              <option value="9:16">9:16 (Dọc)</option>
              <option value="1:1">1:1 (Vuông)</option>
            </select>
          </div>

          <div className="flex justify-end pt-4 mt-2">
            <button onClick={saveSettings} className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">Lưu thay đổi</button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
