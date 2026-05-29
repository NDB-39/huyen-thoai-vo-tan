/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, FormEvent } from "react";
import { Send, Image as ImageIcon, Info, Save, Settings, Download, Upload, ArrowLeft, Trash2 } from "lucide-react";
import { Dialog } from "./components/Dialog";
import { ChatEntry, Difficulty, GameState, GameMode, GameSettings } from "./types";
import { motion, AnimatePresence } from "motion/react";
import { SetupScreen } from "./components/SetupScreen";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { get, set, del } from 'idb-keyval';

export default function App() {
  const [history, setHistory] = useState<ChatEntry[]>([]);
  const [mode, setMode] = useState<GameMode>("hybrid");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [hasStarted, setHasStarted] = useState(false);
  
  const [settings, setSettings] = useState<GameSettings>({
    textModelsList: ["openai", "mistral", "mistral-large", "llama"],
    imageModelsList: ["flux", "turbo"],
    currentTextModel: "openai",
    currentImageModel: "flux"
  });

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  
  const [saveDataString, setSaveDataString] = useState("");
  const [loadDataString, setLoadDataString] = useState("");
  
  // Settings temp state in Dialog
  const [textListStr, setTextListStr] = useState(settings.textModelsList.join(", "));
  const [imageListStr, setImageListStr] = useState(settings.imageModelsList.join(", "));
  const [txtModel, setTxtModel] = useState(settings.currentTextModel);
  const [imgModel, setImgModel] = useState(settings.currentImageModel);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history, hasStarted]);

  // Load state from IndexedDB on mount
  useEffect(() => {
    const loadState = async () => {
      try {
        const savedState = await get<GameState>('game-state');
        if (savedState && savedState.history && Array.isArray(savedState.history) && savedState.history.length > 0) {
          setHistory(savedState.history);
          if (savedState.difficulty) setDifficulty(savedState.difficulty);
          if (savedState.mode) setMode(savedState.mode);
          if (savedState.settings) setSettings(savedState.settings);
          setHasStarted(true);
        }
      } catch (e) {
        console.error("Failed to load from IndexedDB", e);
      }
    };
    loadState();
  }, []);

  // Auto-save state to IndexedDB
  useEffect(() => {
    if (hasStarted) {
      const gameState: GameState = { history, difficulty, mode, settings };
      set('game-state', gameState).catch(console.error);
    }
  }, [history, difficulty, mode, settings, hasStarted]);

  // Sync temp setting state when dialog opens
  useEffect(() => {
    if (showSettingsDialog) {
      setTextListStr(settings.textModelsList.join(", "));
      setImageListStr(settings.imageModelsList.join(", "));
      setTxtModel(settings.currentTextModel);
      setImgModel(settings.currentImageModel);
    }
  }, [showSettingsDialog, settings]);

  const saveSettings = () => {
    const newTextList = textListStr.split(',').map(s => s.trim()).filter(Boolean);
    const newImgList = imageListStr.split(',').map(s => s.trim()).filter(Boolean);
    setSettings({
      textModelsList: newTextList.length ? newTextList : ['openai'],
      imageModelsList: newImgList.length ? newImgList : ['flux'],
      currentTextModel: txtModel,
      currentImageModel: imgModel
    });
    setShowSettingsDialog(false);
  };

  const startGame = (systemPrompt: string, selectedMode: GameMode) => {
    setMode(selectedMode);
    setHistory([{
      id: "system-1",
      role: "system",
      text: systemPrompt
    }, {
      id: "system-2",
      role: "system",
      text: "Chào mừng! Bạn đã bắt đầu cuộc hành trình. Hãy nhập hành động của bạn hoặc gửi trống (/next) để tiếp tục mạch truyện. Để xem trợ giúp, gõ /help."
    }]);
    setHasStarted(true);
    
    // Auto trigger first generation based on context
    handleAiRequest(systemPrompt, [], "Bắt đầu câu chuyện");
  };

  const handleCommand = async (commandStr: string) => {
    const args = commandStr.split(" ");
    const command = args[0].toLowerCase();
    
    switch (command) {
      case "/help":
        setShowHelpDialog(true);
        return true;
      case "/save":
        const gameState: GameState = { history, difficulty, mode, settings };
        setSaveDataString(JSON.stringify(gameState));
        setShowSaveDialog(true);
        return true;
      case "/load":
        setShowLoadDialog(true);
        return true;
      case "/diff":
      case "/settings":
      case "/difficulty":
        setShowSettingsDialog(true);
        return true;
      case "/image":
        const prompt = args.slice(1).join(" ");
        if (!prompt) {
          addSystemMessage("Lệnh /image cần kèm theo mô tả nhân vật/khung cảnh. Ví dụ: /image một chiến binh áo giáp vàng");
        } else {
          await generateImage(prompt);
        }
        return true;
      case "/clear":
      case "/reset":
        setHasStarted(false);
        setHistory([]);
        del('game-state').catch(console.error);
        return true;
      case "/stats":
        // Generate stats via AI
        handleAiRequest(
          "Bạn là hệ thống theo dõi trạng thái. Dựa trên diễn biến cốt truyện từ đầu đến giờ, hãy tóm tắt ngắn gọn và suy luận hợp lý về Chỉ số nhân vật của người chơi (Tên, Thể lực, Máu/Năng lượng, Vai trò) và Hành trang (Inventory - các vật phẩm đang mang theo). Trình bày rõ ràng và đẹp mắt bằng danh sách Markdown.", 
          history.slice(1), 
          "Hãy hiển thị bảng thông tin chỉ số và hành trang hiện tại của tôi."
        );
        return true;
      case "/next":
        return false;
      default:
        if (commandStr.startsWith("/")) {
          addSystemMessage("Lệnh không hợp lệ: " + commandStr + ". Gõ /help để xem danh sách lệnh.");
          return true;
        }
        return false;
    }
  };

  const addSystemMessage = (text: string) => {
    setHistory(prev => [...prev, { id: Date.now().toString(), role: "system", text }]);
  };

  const generateImage = async (prompt: string) => {
    setIsLoading(true);
    const entryId = Date.now().toString();
    setHistory(prev => [...prev, { id: entryId, role: "system", text: "Đang tạo ảnh..." }]);
    
    try {
      const rand = Math.floor(Math.random() * 1000000);
      const url = `https://pollinations-proxy.spritenguyen.workers.dev/prompt/${encodeURIComponent(prompt)}?model=${settings.currentImageModel}&nologo=true&seed=${rand}`;
      
      // Attempt to load the image first before showing it
      const img = new Image();
      img.src = url;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      setHistory(prev => prev.map(entry => 
        entry.id === entryId ? { ...entry, text: "", imageUrl: url } : entry
      ));
    } catch (e) {
      setHistory(prev => prev.map(entry => 
        entry.id === entryId ? { ...entry, text: "Lỗi tạo ảnh. Vui lòng thử lại với mô tả khác." } : entry
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAiRequest = async (systemInstruction: string, chatHistory: ChatEntry[], promptText: string) => {
    setIsLoading(true);

    try {
      let diffText = "";
      if (difficulty === "easy") diffText = " Mức độ dễ: Thử thách từ tốn, tha thứ cho sai lầm.";
      else if (difficulty === "hard") diffText = " Mức độ KHÓ: Kẻ địch tàn nhẫn, sai lầm có hậu quả lớn.";

      let messages = [
        { role: "system", content: systemInstruction + diffText }
      ];

      // Map local roles to OpenAI standards
      chatHistory.forEach(h => {
        if (h.role === "system") return; // exclude system hints from context
        messages.push({
          role: h.role === "user" ? "user" : "assistant",
          content: h.text
        });
      });

      messages.push({ role: "user", content: promptText });

      const res = await fetch("https://pollinations-proxy.spritenguyen.workers.dev/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          model: settings.currentTextModel || "openai",
          messages
        })
      });

      if (!res.ok) throw new Error("API Proxy Error");
      const data = await res.json();
      
      setHistory(prev => [...prev, { 
        id: Date.now().toString(), 
        role: "storyteller", 
        text: data.choices[0].message.content 
      }]);
      
    } catch (err: any) {
      addSystemMessage("Lỗi kết nối: " + (err.message || "Không thể kết nối đến máy chủ."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    
    const text = input.trim() || "/next";
    setInput("");
    
    // Process local commands
    if (text.startsWith("/")) {
      const isHandledLocally = await handleCommand(text);
      if (isHandledLocally) return;
    }

    const userEntry: ChatEntry = { id: Date.now().toString(), role: "user", text };
    const newHistory = [...history, userEntry];
    setHistory(newHistory);
    
    const systemPromptEntry = newHistory.find(h => h.id === "system-1");
    if (systemPromptEntry) {
      await handleAiRequest(systemPromptEntry.text, newHistory.slice(1, -1), text);
    }
  };

  const loadSaveData = () => {
    try {
      const state: GameState = JSON.parse(loadDataString);
      if (state && state.history && Array.isArray(state.history)) {
        setHistory(state.history);
        if (state.difficulty) setDifficulty(state.difficulty);
        if (state.mode) setMode(state.mode);
        if (state.settings) setSettings(state.settings);
        
        setHasStarted(true);
        setShowLoadDialog(false);
        setLoadDataString("");
        addSystemMessage("Đã tải tiến trình thành công!");
      } else {
        addSystemMessage("Dữ liệu lưu không hợp lệ.");
      }
    } catch (e) {
      addSystemMessage("Mã lưu trữ không đúng định dạng JSON.");
    }
  };

  if (!hasStarted) {
    return <SetupScreen onStart={startGame} settings={settings} updateSettings={setSettings} />;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm z-10 shrink-0">
        <div className="flex items-center space-x-3">
          <button onClick={() => setHasStarted(false)} className="p-2 mr-1 text-gray-400 hover:text-indigo-600 transition" title="Quay lại">
            <ArrowLeft size={20} />
          </button>
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-indigo-200 shadow-lg">
            <span className="text-white font-bold text-xl">H</span>
          </div>
          <div>
            <h1 className="font-bold text-lg md:text-xl text-gray-900 tracking-tight">Huyền Thoại Vô Tận</h1>
            <p className="text-xs text-indigo-600 font-medium">
              Độ khó: {difficulty === "easy" ? "Dễ" : difficulty === "hard" ? "Khó" : "Bình thường"} • 
              Chế độ: {mode === "game" ? "Trò Chơi" : mode === "story" ? "Cốt Truyện" : "Game+Truyện"}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-1 md:space-x-2">
          <button onClick={() => setShowSettingsDialog(true)} className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Cài đặt">
            <Settings size={20} />
          </button>
          <button onClick={() => setShowHelpDialog(true)} className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Trợ giúp">
            <Info size={20} />
          </button>
          <div className="h-6 w-px bg-gray-200 mx-1"></div>
          <button onClick={() => {
            const gameState: GameState = { history, difficulty, mode, settings };
            setSaveDataString(JSON.stringify(gameState));
            setShowSaveDialog(true);
          }} className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors flex items-center space-x-1" title="Lưu game">
            <Download size={20} /> <span className="hidden md:inline text-sm font-medium">Lưu</span>
          </button>
          <button onClick={() => setShowLoadDialog(true)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center space-x-1" title="Tải game">
            <Upload size={20} /> <span className="hidden md:inline text-sm font-medium">Tải</span>
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
          <AnimatePresence initial={false}>
            {history.filter(h => h.id !== "system-1").map((entry) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${entry.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {entry.role === "storyteller" && (
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center mr-3 shrink-0 shadow-sm border border-indigo-200">
                    <span className="text-indigo-700 text-xs font-bold font-serif">AI</span>
                  </div>
                )}
                
                <div 
                  className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 ${
                    entry.role === "user" 
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 rounded-tr-sm" 
                      : entry.role === "system"
                        ? "bg-gray-200 text-gray-600 italic text-sm text-center mx-auto w-full"
                        : "bg-white border border-gray-100 shadow-sm text-gray-800 rounded-tl-sm prose prose-indigo leading-relaxed"
                  }`}
                >
                  {entry.imageUrl ? (
                    <img src={entry.imageUrl} alt="Generated" className="rounded-lg w-full h-auto shadow-sm" />
                  ) : entry.role === "storyteller" ? (
                    <div className="w-full max-w-none text-current">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.text}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{entry.text}</div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center mr-3 shrink-0 shadow-sm border border-indigo-200">
                <span className="text-indigo-700 text-xs font-bold font-serif">AI</span>
              </div>
              <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-sm p-4 flex items-center space-x-2">
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="bg-white border-t p-4 shrink-0">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex items-end space-x-2">
          <div className="flex-1 bg-gray-100 rounded-2xl border border-gray-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-200 transition-all shadow-inner overflow-hidden flex items-center">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Nhập hành động của bạn, hoặc chỉ gửi để tiếp tục (/next)..."
              className="w-full bg-transparent border-none focus:ring-0 resize-none p-4 text-gray-800 placeholder-gray-400 outline-none max-h-32 min-h-[56px]"
              rows={1}
              disabled={isLoading}
            />
          </div>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => handleCommand("/image " + input)}
            className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 disabled:opacity-50 transition-colors shadow-sm"
            title="Tạo ảnh dựa trên văn bản đã nhập"
          >
            <ImageIcon size={22} />
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="p-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-md shadow-indigo-200 flex items-center justify-center min-w-[56px]"
          >
            <Send size={22} className={input ? "translate-x-0.5" : ""} />
          </button>
        </form>
      </footer>

      {/* Modals */}
      <Dialog isOpen={showHelpDialog} onClose={() => setShowHelpDialog(false)} title="Trợ Giúp Lệnh Game">
        <div className="space-y-4">
          <p className="text-gray-600">Bạn có thể sử dụng các lệnh sau trong ô chat:</p>
          <ul className="space-y-3">
            <li className="bg-gray-50 p-3 rounded-lg border">
              <strong className="text-indigo-600 font-mono text-sm">/next</strong> hoặc <strong className="text-gray-500">Gửi trống</strong>: Tiến tới cảnh tiếp theo một cách mượt mà.
            </li>
            <li className="bg-gray-50 p-3 rounded-lg border">
              <strong className="text-indigo-600 font-mono text-sm">/image [mô tả]</strong>: Tạo ảnh nhân vật tại thời điểm gõ lệnh bằng Pollinations Proxy.
            </li>
            <li className="bg-gray-50 p-3 rounded-lg border">
              <strong className="text-indigo-600 font-mono text-sm">/save</strong>: Sao lưu tiến trình để chuyển thiết bị.
            </li>
            <li className="bg-gray-50 p-3 rounded-lg border">
              <strong className="text-indigo-600 font-mono text-sm">/load</strong>: Khôi phục tiến trình từ mã sao lưu.
            </li>
            <li className="bg-gray-50 p-3 rounded-lg border">
              <strong className="text-indigo-600 font-mono text-sm">/stats</strong>: Xem thông tin và chỉ số nhân vật hiện tại của bạn dựa trên diễn biến cốt truyện.
            </li>
            <li className="bg-gray-50 p-3 rounded-lg border">
              <strong className="text-indigo-600 font-mono text-sm">/diff</strong> hoặc <strong className="text-indigo-600 font-mono text-sm">/settings</strong>: Mở cài đặt (Lựa chọn model sinh chữ/hình ảnh, chỉnh cường độ khó).
            </li>
          </ul>
          <div className="mt-6 flex justify-end">
            <button onClick={() => setShowHelpDialog(false)} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium">Đã hiểu</button>
          </div>
        </div>
      </Dialog>

      <Dialog isOpen={showSettingsDialog} onClose={() => setShowSettingsDialog(false)} title="Cài Đặt Hệ Thống">
        <div className="space-y-6 max-h-[80vh] overflow-y-auto px-1 py-2">
          {/* Difficulty */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Độ Khó Thử Thách</h3>
            <div className="grid grid-cols-1 gap-2">
              {(['easy', 'normal', 'hard'] as Difficulty[]).map((level) => (
                <button
                  key={level}
                  onClick={() => setDifficulty(level)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    difficulty === level 
                      ? 'border-indigo-600 bg-indigo-50' 
                      : 'border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900 capitalize flex items-center justify-between text-sm">
                    {level === 'easy' ? 'Dễ (Tha thứ)' : level === 'normal' ? 'Bình thường' : 'Khó (Trừng phạt)'}
                    {difficulty === level && <div className="w-2 h-2 bg-indigo-600 rounded-full" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-gray-200" />

          {/* User defined APIs */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Tuỳ Chỉnh Model Proxy (Pollinations)</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Danh sách Model Văn Bản (cách nhau dấu phẩy)</label>
                <textarea 
                  value={textListStr}
                  onChange={e => setTextListStr(e.target.value)}
                  className="w-full border rounded-lg p-2 text-sm text-gray-800 font-mono bg-gray-50 focus:bg-white"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Chọn Model Văn Bản</label>
                <select 
                  value={txtModel} 
                  onChange={e => setTxtModel(e.target.value)}
                  className="w-full border rounded-lg p-2 text-sm bg-white"
                >
                  {textListStr.split(',').map(s => s.trim()).filter(Boolean).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  {!textListStr.split(',').map(s => s.trim()).filter(Boolean).includes(txtModel) && (
                    <option value={txtModel}>{txtModel}</option>
                  )}
                </select>
              </div>

              <div className="pt-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Danh sách Model Hình Ảnh (cách nhau dấu phẩy)</label>
                <textarea 
                  value={imageListStr}
                  onChange={e => setImageListStr(e.target.value)}
                  className="w-full border rounded-lg p-2 text-sm text-gray-800 font-mono bg-gray-50 focus:bg-white"
                  rows={2}
                  placeholder="flux, turbo, qwen-image, wan..."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Chọn Model Hình Ảnh</label>
                <select 
                  value={imgModel} 
                  onChange={e => setImgModel(e.target.value)}
                  className="w-full border rounded-lg p-2 text-sm bg-white"
                >
                  {imageListStr.split(',').map(s => s.trim()).filter(Boolean).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  {!imageListStr.split(',').map(s => s.trim()).filter(Boolean).includes(imgModel) && (
                    <option value={imgModel}>{imgModel}</option>
                  )}
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button onClick={() => { setShowSettingsDialog(false) }} className="px-4 py-2 text-gray-600 font-medium mr-2">Huỷ</button>
            <button onClick={saveSettings} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium">Lưu cài đặt</button>
          </div>
        </div>
      </Dialog>

      <Dialog isOpen={showSaveDialog} onClose={() => setShowSaveDialog(false)} title="Lưu Trò Chơi">
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">Sao chép mã dưới đây để mang tiến trình chơi của bạn sang thiết bị (tab) khác.</p>
          <textarea
            readOnly
            className="w-full h-32 p-3 bg-gray-50 border rounded-lg text-xs font-mono text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none"
            value={saveDataString}
          />
          <div className="flex justify-end gap-2 mt-4">
            <button 
              onClick={() => {
                navigator.clipboard.writeText(saveDataString);
                setShowSaveDialog(false);
                addSystemMessage("Đã sao chép mã lưu game!");
              }} 
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition"
            >
              Sao chép mã
            </button>
            <button onClick={() => setShowSaveDialog(false)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium">
              Đóng
            </button>
          </div>
        </div>
      </Dialog>

      <Dialog isOpen={showLoadDialog} onClose={() => setShowLoadDialog(false)} title="Tải Trò Chơi">
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">Dán mã lưu trò chơi của bạn vào ô dưới đây để tiếp tục hành trình.</p>
          <textarea
            className="w-full h-32 p-3 bg-white border border-gray-300 rounded-lg text-xs font-mono text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="Dán JSON state vào đây..."
            value={loadDataString}
            onChange={(e) => setLoadDataString(e.target.value)}
          />
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowLoadDialog(false)} className="px-4 py-2 text-gray-500 hover:text-gray-700 font-medium transition">Hủy</button>
            <button 
              onClick={loadSaveData}
              disabled={!loadDataString.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition font-medium"
            >
              Tải tiến trình
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

