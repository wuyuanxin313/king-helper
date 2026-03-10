import React, { useEffect, useMemo, useRef, useState } from 'react';
import './SmartInputModal.css';
import { Priority, Todo } from '../types/todo';

interface SmartInputModalProps {
  onClose: () => void;
  onCreate: (items: Array<Omit<Todo, 'id' | 'completed' | 'createdAt'>>) => void;
}

const SmartInputModal: React.FC<SmartInputModalProps> = ({ onClose, onCreate }) => {
  const [text, setText] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState(localStorage.getItem('llm.apiKey') || '');
  const [showConfig, setShowConfig] = useState(!localStorage.getItem('llm.apiKey'));
  const [parsedItems, setParsedItems] = useState<Array<Omit<Todo, 'id' | 'completed' | 'createdAt'>> | null>(null);

  useEffect(() => {
    if (!localStorage.getItem('llm.apiKey')) {
      setShowConfig(true);
    }
  }, []);

  const saveConfig = () => {
    if (apiKeyInput.trim()) {
      localStorage.setItem('llm.apiKey', apiKeyInput.trim());
      // Optional: set defaults for others if missing
      if (!localStorage.getItem('llm.apiBase')) {
        localStorage.setItem('llm.apiBase', 'https://ark.cn-beijing.volces.com/api/v3/chat/completions');
      }
      setShowConfig(false);
    }
  };
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const xfyunWsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const supported = useMemo(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    return !!SR;
  }, []);
  const useSTTFallback = useMemo(() => {
    const pref = (localStorage.getItem('llm.sttProvider') || '').toLowerCase();
    return !supported || pref === 'file';
  }, [supported]);
  const useXfyun = useMemo(() => {
    const pref = (localStorage.getItem('llm.sttProvider') || '').toLowerCase();
    return pref === 'xfyun';
  }, []);

  useEffect(() => {
    if (!supported) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event: any) => {
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += transcript;
        }
      }
      if (finalText) {
        setText((prev) => (prev ? prev + '\n' + finalText : finalText));
      }
    };
    recognition.onend = () => {
      setIsRecording(false);
    };
    recognitionRef.current = recognition;
    return () => {
      recognitionRef.current = null;
    };
  }, [supported]);

  const startRecording = () => {
    if (useXfyun) {
      startXfyunStreaming();
      return;
    }
    if (!useSTTFallback) {
      if (!supported || !recognitionRef.current) return;
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch {}
      return;
    }
    // Fallback: use MediaRecorder to capture audio and later transcribe
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        recordedChunksRef.current = [];
        recorder.ondataavailable = (e: BlobEvent) => {
          if (e.data && e.data.size > 0) {
            recordedChunksRef.current.push(e.data);
          }
        };
        recorder.onstop = async () => {
          const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
          await transcribeBlob(blob);
          stream.getTracks().forEach((t) => t.stop());
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
      })
      .catch(() => {
        try {
          window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: '无法访问麦克风' } }));
        } catch {}
      });
  };

  const stopRecording = () => {
    if (useXfyun) {
      stopXfyunStreaming();
      return;
    }
    if (!useSTTFallback) {
      if (!supported || !recognitionRef.current) return;
      try {
        recognitionRef.current.stop();
        setIsRecording(false);
      } catch {}
      return;
    }
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      mediaRecorderRef.current = null;
      setIsRecording(false);
    }
  };

  const splitTasks = (s: string) => [s.trim()].filter(Boolean);

  const parseWithLLM = async (input: string) => {
    try {
      const apiBase = localStorage.getItem('llm.apiBase') || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
      const apiKey = localStorage.getItem('llm.apiKey') || '';
      const model = localStorage.getItem('llm.model') || 'doubao-seed-1-8-251228';
      const maxCompletionTokens = Number(localStorage.getItem('llm.maxCompletionTokens') || '') || 4096;
      const reasoningEffort = localStorage.getItem('llm.reasoning_effort') || 'minimal';
      if (!apiKey) {
        throw new Error('未配置 API Key，请检查配置');
      }
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;
      const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
      const tzOffsetMin = now.getTimezoneOffset();
      const offsetHours = Math.floor(Math.abs(tzOffsetMin) / 60);
      const offsetMinutes = Math.abs(tzOffsetMin) % 60;
      const sign = tzOffsetMin === 0 ? '+' : (tzOffsetMin > 0 ? '-' : '+');
      const tzOffsetStr = `${sign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;
      const systemPrompt =
        `你是一个待办解析助手。今天是 ${todayStr}，时区为 ${tzName} (UTC${tzOffsetStr})。` +
        `将用户输入拆分为多个任务，若出现相对时间（如“今天”“明天”“下周一”），请基于上述日期与时区转换为绝对日期（YYYY-MM-DD）。` +
        `输出严格的JSON数组，每项包含: title(字符串), dueDate(YYYY-MM-DD或为空), dueTime(HH:mm或为空), priority(低|中|高或为空)。只输出JSON，不包含其他文本。`;
      const body = {
        model,
        temperature: 0,
        max_completion_tokens: maxCompletionTokens,
        reasoning_effort: reasoningEffort,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          { role: 'user', content: input },
        ],
      };
      const resp = await fetch(apiBase, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
      
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`API请求失败: ${resp.status} - ${errText.slice(0, 100)}`);
      }

      const data = await resp.json();
      const content =
        data?.choices?.[0]?.message?.content ||
        data?.choices?.[0]?.delta?.content ||
        '';
      let jsonText = content;
      const match = content && content.match(/[\[{][\s\S]*[\]}]/);
      if (match) jsonText = match[0];
      const arr = JSON.parse(jsonText);
      if (!Array.isArray(arr)) return null;
      const toItems = arr.map((t: any) => {
        let dueTs: number | undefined;
        const rawDue = t.dueDate;
        const rawTime = t.dueTime;
        if (rawDue) {
          if (typeof rawDue === 'string') {
            const m = rawDue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
            if (m) {
              const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
              if (typeof rawTime === 'string' && /^\d{1,2}:\d{2}$/.test(rawTime)) {
                const [hh, mm] = rawTime.split(':');
                d.setHours(Number(hh) || 0, Number(mm) || 0, 0, 0);
              } else {
                d.setHours(0, 0, 0, 0);
              }
              dueTs = d.getTime();
            } else {
              const d = new Date(rawDue);
              if (!isNaN(d.getTime())) {
                if (typeof rawTime === 'string' && /^\d{1,2}:\d{2}$/.test(rawTime)) {
                  const [hh, mm] = rawTime.split(':');
                  d.setHours(Number(hh) || 0, Number(mm) || 0, 0, 0);
                } else {
                  d.setHours(0, 0, 0, 0);
                }
                dueTs = d.getTime();
              }
            }
          } else {
            const d = new Date(rawDue);
            if (!isNaN(d.getTime())) {
              if (typeof rawTime === 'string' && /^\d{1,2}:\d{2}$/.test(rawTime)) {
                const [hh, mm] = rawTime.split(':');
                d.setHours(Number(hh) || 0, Number(mm) || 0, 0, 0);
              } else {
                d.setHours(0, 0, 0, 0);
              }
              dueTs = d.getTime();
            }
          }
        }
        let prio: Priority | undefined;
        const p = (t.priority || '').toLowerCase();
        if (p.includes('高')) prio = 'high';
        else if (p.includes('中')) prio = 'medium';
        else if (p.includes('低')) prio = 'low';
        return {
          title: String(t.title || '').trim(),
          dueDate: dueTs,
          dueTime: (typeof rawTime === 'string' && /^\d{1,2}:\d{2}$/.test(rawTime)) ? rawTime : undefined,
          priority: prio,
        };
      });
      return toItems;
    } catch (e: any) {
      console.error('LLM Parse Error:', e);
      return e.message || '解析发生未知错误';
    }
  };

  const transcribeBlob = async (blob: Blob) => {
    try {
      const sttApiBase = localStorage.getItem('llm.sttApiBase') || 'https://api.openai.com/v1/audio/transcriptions';
      const sttApiKey = localStorage.getItem('llm.sttApiKey') || localStorage.getItem('llm.apiKey') || '';
      const sttModel = localStorage.getItem('llm.sttModel') || 'whisper-1';
      if (!sttApiKey) {
        throw new Error('未配置语音转文字的 API Key');
      }
      const form = new FormData();
      form.append('file', blob, 'speech.webm');
      form.append('model', sttModel);
      form.append('language', 'zh');
      const resp = await fetch(sttApiBase, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sttApiKey}`,
        },
        body: form,
      });
      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`转写失败: ${resp.status} ${err.slice(0, 120)}`);
      }
      const data = await resp.json();
      const text = data?.text || data?.result || '';
      if (text) {
        setText((prev) => (prev ? prev + '\n' + text : text));
      } else {
        throw new Error('未返回文本');
      }
    } catch (e: any) {
      console.error('STT Error:', e);
      try {
        window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: e.message || '语音转文字失败' } }));
      } catch {}
    }
  };

  const md5Hex = (str: string) => {
    function rhex(n: number) { const s = '0123456789abcdef'; let j = 0; let out = ''; for (; j < 4; j++) out += s[(n >> (j * 8 + 4)) & 0x0f] + s[(n >> (j * 8)) & 0x0f]; return out; }
    function str2blks_MD5(s: string) { const nblk = ((s.length + 8) >> 6) + 1; const blks = new Array(nblk * 16); for (let i = 0; i < nblk * 16; i++) blks[i] = 0; for (let i = 0; i < s.length; i++) blks[i >> 2] |= s.charCodeAt(i) << ((i % 4) * 8); blks[s.length >> 2] |= 0x80 << ((s.length % 4) * 8); blks[nblk * 16 - 2] = s.length * 8; return blks; }
    function add(x: number, y: number) { const lsw = (x & 0xffff) + (y & 0xffff); const msw = (x >> 16) + (y >> 16) + (lsw >> 16); return (msw << 16) | (lsw & 0xffff); }
    function rol(num: number, cnt: number) { return (num << cnt) | (num >>> (32 - cnt)); }
    function cmn(q: number, a: number, b: number, x: number, s: number, t: number) { return add(rol(add(add(a, q), add(x, t)), s), b); }
    function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn((b & c) | (~b & d), a, b, x, s, t); }
    function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn((b & d) | (c & ~d), a, b, x, s, t); }
    function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn(b ^ c ^ d, a, b, x, s, t); }
    function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn(c ^ (b | ~d), a, b, x, s, t); }
    const x = str2blks_MD5(str); let a = 1732584193; let b = -271733879; let c = -1732584194; let d = 271733878;
    for (let i = 0; i < x.length; i += 16) {
      const olda = a, oldb = b, oldc = c, oldd = d;
      a = ff(a, b, c, d, x[i + 0], 7, -680876936); d = ff(d, a, b, c, x[i + 1], 12, -389564586); c = ff(c, d, a, b, x[i + 2], 17, 606105819); b = ff(b, c, d, a, x[i + 3], 22, -1044525330);
      a = ff(a, b, c, d, x[i + 4], 7, -176418897); d = ff(d, a, b, c, x[i + 5], 12, 1200080426); c = ff(c, d, a, b, x[i + 6], 17, -1473231341); b = ff(b, c, d, a, x[i + 7], 22, -45705983);
      a = ff(a, b, c, d, x[i + 8], 7, 1770035416); d = ff(d, a, b, c, x[i + 9], 12, -1958414417); c = ff(c, d, a, b, x[i + 10], 17, -42063); b = ff(b, c, d, a, x[i + 11], 22, -1990404162);
      a = ff(a, b, c, d, x[i + 12], 7, 1804603682); d = ff(d, a, b, c, x[i + 13], 12, -40341101); c = ff(c, d, a, b, x[i + 14], 17, -1502002290); b = ff(b, c, d, a, x[i + 15], 22, 1236535329);
      a = gg(a, b, c, d, x[i + 1], 5, -165796510); d = gg(d, a, b, c, x[i + 6], 9, -1069501632); c = gg(c, d, a, b, x[i + 11], 14, 643717713); b = gg(b, c, d, a, x[i + 0], 20, -373897302);
      a = gg(a, b, c, d, x[i + 5], 5, -701558691); d = gg(d, a, b, c, x[i + 10], 9, 38016083); c = gg(c, d, a, b, x[i + 15], 14, -660478335); b = gg(b, c, d, a, x[i + 4], 20, -405537848);
      a = gg(a, b, c, d, x[i + 9], 5, 568446438); d = gg(d, a, b, c, x[i + 14], 9, -1019803690); c = gg(c, d, a, b, x[i + 3], 14, -187363961); b = gg(b, c, d, a, x[i + 8], 20, 1163531501);
      a = gg(a, b, c, d, x[i + 13], 5, -1444681467); d = gg(d, a, b, c, x[i + 2], 9, -51403784); c = gg(c, d, a, b, x[i + 7], 14, 1735328473); b = gg(b, c, d, a, x[i + 12], 20, -1926607734);
      a = hh(a, b, c, d, x[i + 5], 4, -378558); d = hh(d, a, b, c, x[i + 8], 11, -2022574463); c = hh(c, d, a, b, x[i + 11], 16, 1839030562); b = hh(b, c, d, a, x[i + 14], 23, -35309556);
      a = hh(a, b, c, d, x[i + 1], 4, -1530992060); d = hh(d, a, b, c, x[i + 9], 11, 1272893353); c = hh(c, d, a, b, x[i + 13], 16, -155497632); b = hh(b, c, d, a, x[i + 0], 23, -1094730640);
      a = hh(a, b, c, d, x[i + 4], 4, 681279174); d = hh(d, a, b, c, x[i + 12], 11, -358537222); c = hh(c, d, a, b, x[i + 2], 16, -722521979); b = hh(b, c, d, a, x[i + 10], 23, 76029189);
      a = ii(a, b, c, d, x[i + 0], 6, -145353882); d = ii(d, a, b, c, x[i + 7], 10, -1120210379); c = ii(c, d, a, b, x[i + 14], 15, 718787259); b = ii(b, c, d, a, x[i + 5], 21, -343485551);
      a = ii(a, b, c, d, x[i + 12], 6, -995338651); d = ii(d, a, b, c, x[i + 3], 10, -157736); c = ii(c, d, a, b, x[i + 10], 15, 112689141); b = ii(b, c, d, a, x[i + 1], 21, -1416354905);
      a = add(a, olda); b = add(b, oldb); c = add(c, oldc); d = add(d, oldd);
    }
    return rhex(a) + rhex(b) + rhex(c) + rhex(d);
  };
  const hmacSha1Base64 = async (key: string, messageHex: string) => {
    const enc = new TextEncoder();
    const keyData = enc.encode(key);
    const msgData = enc.encode(messageHex);
    const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
    const bytes = new Uint8Array(signature);
    let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  };
  const downsampleTo16k = (buffer: Float32Array, inputSampleRate: number) => {
    const ratio = inputSampleRate / 16000;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
      let accum = 0, count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = accum / count;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    const out = new Int16Array(result.length);
    for (let i = 0; i < result.length; i++) {
      let s = Math.max(-1, Math.min(1, result[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return out;
  };
  const startXfyunStreaming = async () => {
    try {
      const appid = localStorage.getItem('xfyun.appid') || '';
      const apiKey = localStorage.getItem('xfyun.apiKey') || '';
      if (!appid || !apiKey) {
        throw new Error('请在配置中填写讯飞 appid 与 apiKey');
      }
      const ts = Math.floor(Date.now() / 1000).toString();
      const baseString = appid + ts;
      const md5 = md5Hex(baseString);
      const signa = await hmacSha1Base64(apiKey, md5);
      const url = `wss://rtasr.xfyun.cn/v1/ws?appid=${encodeURIComponent(appid)}&ts=${encodeURIComponent(ts)}&signa=${encodeURIComponent(signa)}`;
      const ws = new WebSocket(url);
      xfyunWsRef.current = ws;
      ws.onopen = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        audioSourceRef.current = source;
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        audioProcessorRef.current = processor;
        const sendBuffer: number[] = [];
        processor.onaudioprocess = (e) => {
          const input = e.inputBuffer.getChannelData(0);
          const pcm16 = downsampleTo16k(input, ctx.sampleRate);
          for (let i = 0; i < pcm16.length; i++) {
            sendBuffer.push(pcm16[i] & 0xff, (pcm16[i] >> 8) & 0xff);
          }
          while (sendBuffer.length >= 1280) {
            const chunk = new Uint8Array(sendBuffer.splice(0, 1280));
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(chunk);
            }
          }
        };
        source.connect(processor);
        processor.connect(ctx.destination);
        setIsRecording(true);
      };
      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.action === 'result' && data.code === '0') {
            const payload = JSON.parse(data.data || '{}');
            const rt = payload?.cn?.st?.rt || [];
            const words: string[] = [];
            for (const seg of rt) {
              const wsArr = seg.ws || [];
              for (const wsItem of wsArr) {
                const cwArr = wsItem.cw || [];
                for (const cw of cwArr) {
                  if (cw.w) words.push(cw.w);
                }
              }
            }
            if (words.length) {
              const textFrag = words.join('');
              setText((prev) => (prev ? prev + textFrag : textFrag));
            }
          }
        } catch {}
      };
      ws.onerror = () => {
        try {
          window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: '讯飞连接错误' } }));
        } catch {}
      };
      ws.onclose = () => {
        setIsRecording(false);
      };
    } catch (e: any) {
      try {
        window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: e.message || '讯飞连接失败' } }));
      } catch {}
    }
  };
  const stopXfyunStreaming = () => {
    try {
      const ws = xfyunWsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(new TextEncoder().encode(JSON.stringify({ end: true })));
        ws.close();
      }
      xfyunWsRef.current = null;
      const proc = audioProcessorRef.current;
      const src = audioSourceRef.current;
      const ctx = audioCtxRef.current;
      if (proc && src) {
        try { proc.disconnect(); } catch {}
        try { src.disconnect(); } catch {}
      }
      if (ctx) {
        try { ctx.close(); } catch {}
      }
      audioProcessorRef.current = null;
      audioSourceRef.current = null;
      audioCtxRef.current = null;
      setIsRecording(false);
    } catch {}
  };
  

  const createFromText = () => {
    const segments = splitTasks(text);
    if (segments.length === 0) {
      onClose();
      return;
    }
    const run = async () => {
      const result = await parseWithLLM(text);
      if (typeof result === 'string') {
        // Error message
        try {
          window.dispatchEvent(
            new CustomEvent('app:toast', {
              detail: { message: `解析失败: ${result}` },
            })
          );
        } catch {}
      } else if (!result || result.length === 0) {
        // Empty result but no error thrown?
        try {
          window.dispatchEvent(
            new CustomEvent('app:toast', {
              detail: { message: '解析结果为空，请尝试更详细的描述' },
            })
          );
        } catch {}
      } else {
        setParsedItems(result);
      }
    };
    run();
  };

  const confirmAdd = () => {
    if (parsedItems && parsedItems.length > 0) {
      onCreate(parsedItems);
      try {
        window.dispatchEvent(
          new CustomEvent('app:toast', {
            detail: { message: `解析成功，已创建${parsedItems.length}条任务` },
          })
        );
      } catch {}
      onClose();
    }
  };
  
  const updateItemField = (idx: number, field: 'title' | 'dueDate' | 'dueTime' | 'priority', value: any) => {
    if (!parsedItems) return;
    const next = parsedItems.map((it, i) => {
      if (i !== idx) return it;
      if (field === 'dueDate') {
        if (!value) {
          return { ...it, dueDate: undefined };
        }
        const d = new Date(value);
        if (!isNaN(d.getTime())) {
          d.setHours(0, 0, 0, 0);
          return { ...it, dueDate: d.getTime() };
        }
        return it;
      }
      if (field === 'dueTime') {
        const v = String(value || '');
        return { ...it, dueTime: v ? v : undefined };
      }
      if (field === 'priority') {
        const v = value as string;
        return { ...it, priority: (v || undefined) as any };
      }
      return { ...it, title: String(value) };
    });
    setParsedItems(next);
  };

  return (
    <div className="smart-input-modal-overlay">
      <div className="smart-input-modal">
        <div className="smart-input-header">
          <div className="smart-input-title">智能创建任务</div>
          <button type="button" className="smart-close-btn" onClick={onClose}>×</button>
        </div>
        
        {showConfig ? (
          <div className="smart-config-body" style={{ padding: '20px' }}>
             <div style={{ marginBottom: '10px', fontSize: '14px', color: '#666' }}>
               初次使用请配置 API Key (Doubao/Ark 或 OpenAI)
             </div>
             <input
               type="text"
               className="smart-textarea"
               style={{ height: '40px', marginBottom: '10px' }}
               placeholder="请输入 API Key (sk-...)"
               value={apiKeyInput}
               onChange={(e) => setApiKeyInput(e.target.value)}
             />
             <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
               <label style={{ fontSize: '13px', color: '#666' }}>语音识别提供方式</label>
               <select
                 className="smart-textarea"
                 style={{ height: '36px', flex: '0 0 160px' }}
                 defaultValue={localStorage.getItem('llm.sttProvider') || (supported ? 'webspeech' : 'file')}
                 onChange={(e) => localStorage.setItem('llm.sttProvider', e.target.value)}
               >
                 <option value="webspeech">浏览器内置(Web Speech)</option>
                 <option value="file">录音上传(STT API)</option>
                 <option value="xfyun">讯飞实时转写(WebSocket)</option>
               </select>
             </div>
             <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
               <label style={{ fontSize: '13px', color: '#666' }}>讯飞 AppID</label>
               <input
                 type="text"
                 className="smart-textarea"
                 style={{ height: '36px', flex: '0 0 200px' }}
                 placeholder="xfyun.appid"
                 defaultValue={localStorage.getItem('xfyun.appid') || ''}
                 onChange={(e) => localStorage.setItem('xfyun.appid', e.target.value)}
               />
               <label style={{ fontSize: '13px', color: '#666' }}>讯飞 ApiKey</label>
               <input
                 type="text"
                 className="smart-textarea"
                 style={{ height: '36px', flex: '1 1 auto' }}
                 placeholder="xfyun.apiKey"
                 defaultValue={localStorage.getItem('xfyun.apiKey') || ''}
                 onChange={(e) => localStorage.setItem('xfyun.apiKey', e.target.value)}
               />
             </div>
             <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
               <label style={{ fontSize: '13px', color: '#666' }}>STT API Base</label>
               <input
                 type="text"
                 className="smart-textarea"
                 style={{ height: '36px', flex: 1 }}
                 placeholder="例如 https://api.openai.com/v1/audio/transcriptions"
                 defaultValue={localStorage.getItem('llm.sttApiBase') || ''}
                 onChange={(e) => localStorage.setItem('llm.sttApiBase', e.target.value)}
               />
             </div>
             <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
               <label style={{ fontSize: '13px', color: '#666' }}>STT 模型</label>
               <input
                 type="text"
                 className="smart-textarea"
                 style={{ height: '36px', flex: '0 0 200px' }}
                 placeholder="例如 whisper-1"
                 defaultValue={localStorage.getItem('llm.sttModel') || ''}
                 onChange={(e) => localStorage.setItem('llm.sttModel', e.target.value)}
               />
             </div>
             <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
               <label style={{ fontSize: '13px', color: '#666' }}>STT API Key</label>
               <input
                 type="text"
                 className="smart-textarea"
                 style={{ height: '36px', flex: 1 }}
                 placeholder="未填写则复用上面的 API Key"
                 defaultValue={localStorage.getItem('llm.sttApiKey') || ''}
                 onChange={(e) => localStorage.setItem('llm.sttApiKey', e.target.value)}
               />
             </div>
             <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="smart-create-btn" onClick={() => setShowConfig(false)} style={{ background: '#ccc' }}>取消</button>
                <button type="button" className="smart-create-btn" onClick={saveConfig}>保存配置</button>
             </div>
          </div>
        ) : parsedItems ? (
          <div className="smart-preview-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
             <div style={{ marginBottom: '10px', fontSize: '14px', color: '#666' }}>
               解析结果确认 ({parsedItems.length} 条)
             </div>
             <div className="smart-preview-list" style={{ flex: 1, overflowY: 'auto', marginBottom: '15px', border: '1px solid #eee', borderRadius: '4px', padding: '10px' }}>
                {parsedItems.map((item, idx) => (
                  <div key={idx} style={{ 
                      padding: '10px', 
                      borderBottom: idx < parsedItems.length - 1 ? '1px solid #f0f0f0' : 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                  }}>
                    <input
                      type="text"
                      className="smart-textarea"
                      style={{ height: '36px' }}
                      placeholder="任务标题"
                      value={item.title}
                      onChange={(e) => updateItemField(idx, 'title', e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input
                        type="date"
                        className="smart-textarea"
                        style={{ height: '36px', flex: '0 0 180px' }}
                        value={item.dueDate ? (() => { const d = new Date(item.dueDate); const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const da = String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${da}`; })() : ''}
                        onChange={(e) => updateItemField(idx, 'dueDate', e.target.value)}
                      />
                      <input
                        type="time"
                        className="smart-textarea"
                        style={{ height: '36px', flex: '0 0 120px' }}
                        value={item.dueTime || ''}
                        step="60"
                        onChange={(e) => updateItemField(idx, 'dueTime', e.target.value ? e.target.value.slice(0, 5) : '')}
                      />
                      <select
                        className="smart-textarea"
                        style={{ height: '36px', flex: '0 0 120px' }}
                        value={item.priority || ''}
                        onChange={(e) => updateItemField(idx, 'priority', e.target.value)}
                      >
                        <option value="">无</option>
                        <option value="low">低</option>
                        <option value="medium">中</option>
                        <option value="high">高</option>
                      </select>
                    </div>
                  </div>
                ))}
             </div>
             <div className="smart-input-footer">
               <button type="button" className="smart-create-btn" onClick={() => setParsedItems(null)} style={{ background: '#ccc', marginRight: '10px' }}>返回修改</button>
               <button type="button" className="smart-create-btn" onClick={confirmAdd}>确认添加</button>
             </div>
          </div>
        ) : (
          <>
            <div className="smart-tip">告诉我你要做的所有事，我帮你一键安排！</div>
            <div className="smart-input-body">
              <textarea
                className="smart-textarea"
                placeholder="请输入或通过语音输入，如：明天下午三点提醒我给产品经理发 PRD"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
            <div className="smart-input-footer">
              <div style={{ marginRight: 'auto' }}>
                 <button type="button" className="smart-voice-btn" onClick={() => setShowConfig(true)} title="设置API">⚙️</button>
              </div>
              <button
                type="button"
                className={`smart-voice-btn ${isRecording ? 'recording' : ''}`}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={!supported}
                title={supported ? (isRecording ? '停止录音' : '开始录音') : '当前环境不支持语音输入'}
              >
                🎤
              </button>
              <button type="button" className="smart-create-btn" onClick={createFromText}>解析并创建</button>
            </div>
          </>
        )}
        {!supported && !showConfig && !parsedItems && (
          <div className="smart-warning">当前环境不支持语音识别，请使用文字输入</div>
        )}
      </div>
    </div>
  );
};

export default SmartInputModal;
