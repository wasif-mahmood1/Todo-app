import { FiPlus, FiEdit2, FiTrash2, FiImage, FiCheckCircle } from "react-icons/fi";
import { FaPlus, FaImage } from "react-icons/fa";
import { useState, useEffect } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { supabase } from "../lib/supabaseClient";
import Typewriter from "./hooks/Typewriter";
// dotenv.config();

export default function Todo() {
  const [editingId, setEditingId] = useState(null);
const [editingText, setEditingText] = useState("");

  const [taskText, setTaskText] = useState("");
  const [todos, setTodos] = useState([]);
  const [file, setFile] = useState(null);
  const [fileUploaded, setFileUploaded] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL;
 // const API_BASE =  "http://Todo-app-env.eba-sbk2avzz.eu-north-1.elasticbeanstalk.com";

  useEffect(() => {
    console.log("🔍 App initialized");
    console.log("   API_BASE:", API_BASE);
    // Check if backend is reachable
    fetch(`${API_BASE}/upload/b2-check`, { method: "GET" })
      .then(res => {
        console.log("✅ Backend is reachable:", res.status);
      })
      .catch(err => {
        console.error("❌ Cannot reach backend at", API_BASE, "-", err.message);
        toast.error(`⚠️ Cannot reach backend at ${API_BASE}. Make sure the server is running!`);
      });
  }, []);

  const makeImageSrc = (item) => {
    if (item?.image_path) {
      // image_path is S3 key, use proxy endpoint
      const src = `${API_BASE}/upload/file?path=${encodeURIComponent(item.image_path)}`;
      console.log("✅ Using image_path via proxy:", item.image_path);
      return src;
    }
    if (item?.image_url) {
      // image_url could be either a full signed URL or just a path
      if (item.image_url.startsWith("http")) {
        console.log("✅ Using image_url as signed URL");
        return item.image_url;
      } else {
        // It's a path, use proxy endpoint
        const src = `${API_BASE}/upload/file?path=${encodeURIComponent(item.image_url)}`;
        console.log("✅ Using image_url path via proxy:", item.image_url);
        return src;
      }
    }
    return null;
  };

  const fetchTodos = async () => {
    try {
      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) {
        toast.error("Failed to load todos");
        console.error("❌ Supabase error:", error.message);
        return;
      }

      console.log("✅ Loaded", data?.length || 0, "todos from database");
      const withSrc = (data || []).map((d) => {
        const src = makeImageSrc(d);
        if (src) console.log("   Todo", d.id, "has image:", d.image_path || d.image_url);
        return { ...d, image_src: src };
      });
      setTodos(withSrc);
    } catch (err) {
      console.error("❌ fetchTodos error:", err);
      toast.error("Failed to load todos: " + err.message);
    }
  };

  useEffect(() => {
    fetchTodos();
  }, []);

  
const handleAdd = async () => {
  if (!taskText.trim()) {
    toast.error("Please enter a task");
    return;
  }

  const form = new FormData();
  form.append("task", taskText);
  if (file) form.append("file", file);

  try {
    console.log("📤 Uploading todo...", { hasFile: !!file, task: taskText });
    const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: form });

    if (!res.ok) {
      const errText = await res.text();
      console.error("❌ Upload failed:", res.status, errText);
      toast.error("Upload failed: " + errText);
      return;
    }

    const result = await res.json();
    console.log("✅ Upload response:", { path: result.path, url: result.url });

    let newTodo;
    if (result.todo) {
      newTodo = { ...result.todo, image_src: result.path ? `${API_BASE}/upload/file?path=${encodeURIComponent(result.path)}` : (result.url || makeImageSrc(result.todo)) };
    } else {
      newTodo = {
        task: taskText,
        is_completed: false,
        id: Date.now(),
        image_path: result.path || null,
        image_url: result.url || null,
        image_src: result.path ? `${API_BASE}/upload/file?path=${encodeURIComponent(result.path)}` : result.url || null,
      };
    }

    setTodos((p) => [...p, newTodo]);
    setTaskText("");
    setFile(null);
    setFileUploaded(false);
    toast.success("Todo added!");
  } catch (err) {
    console.error("❌ handleAdd error:", err.message);
    toast.error("Upload failed: " + err.message);
  }
};






  const handleDelete = async (id) => {
    // find item to get image path
    const item = todos.find((t) => t.id === id);

    // delete DB row first (or you can delete storage first then DB)
    const { error } = await supabase.from("todos").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete");
      return;
    }

    // If the item had a Backblaze path, request server to delete file
    if (item?.image_path && !item.image_path.startsWith("http")) {
      try {
        const delRes = await fetch(`${API_BASE}/upload/file?path=${encodeURIComponent(item.image_path)}`, { method: "DELETE" });
        console.log("DELETE file", delRes.status);
        if (!delRes.ok) {
          const json = await delRes.json();
          console.error("Failed to delete file on server:", json);
          toast.warn("Todo removed but failed to delete stored image");
        } else {
          console.log("Removed from storage via server:", item.image_path);
        }
      } catch (e) {
        console.error(e);
      }
    }

    setTodos((prev) => prev.filter((t) => t.id !== id));
    toast.info("Todo deleted");
  };

  
  // const handleEdit = async (id, currentTask) => {
  //   const newText = prompt("Edit todo:", currentTask);
  //   if (!newText || newText.trim() === "") return;

  //   try {
  //     const res = await fetch(`${API_BASE}/upload/${id}`, {
  //       method: "PUT",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ task: newText }),
  //     });

  //     if (!res.ok) {
  //       const errText = await res.text();
  //       toast.error("Failed to edit: " + errText);
  //       return;
  //     }

  //     const result = await res.json();
  //     setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, task: newText } : t)));
  //     toast.success("Todo edited successfully!");
  //   } catch (err) {
  //     toast.error("Failed to edit: " + err.message);
  //   }
  // };
const handleEdit = (id, currentTask) => {
  setEditingId(id);
  setEditingText(currentTask);
};

 const handleSaveEdit = async (id) => {
  if (!editingText.trim()) {
    toast.error("Task cannot be empty");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/upload/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: editingText }),
    });

    if (!res.ok) {
      const errText = await res.text();
      toast.error("Failed to edit: " + errText);
      return;
    }

    setTodos((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, task: editingText } : t
      )
    );

    setEditingId(null);
    setEditingText("");
    toast.success("Todo updated");
  } catch (err) {
    toast.error("Failed to edit: " + err.message);
  }
};

  const handleToggle = async (id, currentState) => {
    try {
      const res = await fetch(`${API_BASE}/upload/toggle/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const errText = await res.text();
        toast.error("Failed to update: " + errText);
        return;
      }

      const result = await res.json();
      setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, is_completed: !currentState } : t)));
      toast.success(result.is_completed ? "Marked as completed!" : "Marked as pending!");
    } catch (err) {
      toast.error("Failed to update: " + err.message);
    }
  };

  const handleImgError = (id) => {
    const item = todos.find((t) => t.id === id);
    if (!item) return;

    console.error("❌ Image load failed for todo:", id);
    console.error("   image_path:", item.image_path);
    console.error("   image_url:", item.image_url);
    console.error("   image_src:", item.image_src);
    console.error("   API_BASE:", API_BASE);

    if (item.image_path) {
      const proxy = `${API_BASE}/upload/file?path=${encodeURIComponent(item.image_path)}`;
      console.warn("📸 Attempting proxy fallback URL:", proxy);
      
      // Check if backend is even responding
      fetch(`${API_BASE}/upload/file?path=${encodeURIComponent(item.image_path)}`, { method: "HEAD" })
        .then(res => {
          if (!res.ok) {
            console.error("❌ Backend returned:", res.status, res.statusText);
            toast.error(`Backend error: ${res.status}. Is the server running on ${API_BASE}?`);
          } else {
            console.log("✅ Backend is responding, updating image source");
            setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, image_src: proxy } : t)));
          }
        })
        .catch(err => {
          console.error("❌ Cannot reach backend:", err.message);
          toast.error(`Cannot reach backend at ${API_BASE}. Is the server running?`);
        });
    } else if (item.image_url) {
      console.warn("📸 Has image_url but failed to load:", item.image_url);
      toast.error("Image load failed. Check S3 bucket CORS settings.");
    } else {
      console.warn("⚠️ No image_path or image_url available");
    }
  };
  const completedCount = todos.filter(t => t.is_completed).length;
const remainingCount = todos.length - completedCount;


  return (
    <>
<div className="min-h-screen w-screen bg-sky-800 flex items-center justify-center px-4">
  <div className="flex flex-col w-full max-w-3xl sm:h-[80vh] p-6 sm:p-10 bg-white shadow-inner rounded-2xl">

          <header className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-extrabold text-blue-800">
                My Todo App
              </h2>
   <Typewriter
  texts={[
    "Every checkmark counts.",
    "Tiny steps, big results.",
    "Tasks today, triumphs tomorrow.",
    "Make it happen, one task at a time.",
    "Beat procrastination, delightfully."
  ]}
  speed={50}   // typing speed per character
  delay={2000} // time before switching to next phrase
  className="text-sm text-gray-500"
/>


            </div>
            <div className="text-sm text-gray-500">
  <span className="font-medium text-gray-700">
    {remainingCount}
  </span>{" "}
  remaining Tasks ·{" "}
  <span className="font-medium text-green-600">
    {completedCount}
  </span>{" "}
  completed Tasks
</div>

          </header>

          {/* INPUT */}
   <div className="flex gap-3 mb-6 items-center">
  <input
    type="text"
    placeholder="Add a task (press Enter)"
    value={taskText}
    onChange={(e) => setTaskText(e.target.value)}
    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
    className="flex-1 px-4 py-3 rounded-lg border border-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
  />

  {/* Add Button */}
{/* Add Task Button */}
<button
  onClick={handleAdd}
  className="flex items-center gap-2 px-4 py-3 rounded-lg bg-gray-200
             hover:bg-gray-300 cursor-pointer transition-colors"
  title="Add task"
>
  <FaPlus size={18} />
  <span className="text-sm font-medium">Add</span>
</button>

{/* Image Upload Button */}
<label
  className={`flex items-center gap-2 px-4 py-3 rounded-lg transition-colors ${
    fileUploaded
      ? "bg-green-200 hover:bg-green-300 cursor-pointer"
      : "bg-gray-200 hover:bg-gray-300 cursor-pointer"
  }`}
  title="Upload image"
>
  <FaImage size={18} />
  <span className="text-sm font-medium">{fileUploaded ? "File Uploaded" : "Upload"}</span>
  <input
    type="file"
    accept="image/*"
    onChange={(e) => {
      const selectedFile = e.target.files?.[0] || null;
      setFile(selectedFile);
      if (selectedFile) {
        setFileUploaded(true);
      }
    }}
    className="hidden"
  />
</label>

</div>


          {/* TODO LIST */}
          
          <div className="flex-1 overflow-y-auto space-y-4 pr-12">

            {todos.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <p className="mb-2">No todos yet</p>
                <p className="text-xs">Add your first task to get started</p>
              </div>
            )}

            {todos.map((item) => (
  <div
    key={item.id}
    className={`flex flex-col gap-2 p-4 rounded-lg border shadow-sm ${
      item.is_completed ? "bg-gray-50 border-gray-100 opacity-80" : "bg-white border-gray-200"
    }`}
  >
    {/* Row with checkbox, task text, and buttons */}
    <div className="flex items-center justify-between gap-4">
     <input
  type="checkbox"
  checked={item.is_completed}
  onChange={() => handleToggle(item.id, item.is_completed)}
  onClick={(e) => e.stopPropagation()}
  className="h-5 w-5 rounded-full"
 />

{editingId === item.id ? (
  <input
    value={editingText}
    onChange={(e) => setEditingText(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === "Enter") handleSaveEdit(item.id);
      if (e.key === "Escape") setEditingId(null);
    }}
    autoFocus
    className="flex-1 px-2 py-1 border rounded-md
               focus:outline-none focus:ring-2 focus:ring-violet-300"
  />
) : (
  <span
    className={`flex-1 min-w-0 truncate ${
      item.is_completed
        ? "line-through text-gray-400"
        : "text-gray-700"
    }`}
  >
    {item.task}
  </span>
)}



<div className="flex gap-2 shrink-0">
  {editingId === item.id ? (
    /* Save button */
    <button
      onClick={() => handleSaveEdit(item.id)}
      className="flex items-center gap-1 px-3 h-9 rounded-lg bg-green-100
                 hover:bg-green-200 text-green-700"
      title="Save"
    >
      <FiCheckCircle size={16} />
      <span className="text-sm font-medium">Save</span>
    </button>
  ) : (
    /* Edit button */
    <button
      onClick={() => handleEdit(item.id, item.task)}
      className="flex items-center gap-1 px-3 h-9 rounded-lg bg-indigo-100
                 hover:bg-indigo-200 text-indigo-700"
      title="Edit"
    >
      <FiEdit2 size={16} />
      <span className="text-sm font-medium">Edit</span>
    </button>
  )}

  {/* Delete button */}
  <button
    onClick={() => handleDelete(item.id)}
    className="flex items-center gap-1 px-3 h-9 rounded-lg bg-red-100
               hover:bg-red-200 text-red-700"
    title="Delete"
  >
    <FiTrash2 size={16} />
    <span className="text-sm font-medium">Delete</span>
  </button>
</div>




    </div>

    {/* Image (optional) */}
    {item.image_src && (
      <div className="mt-2 flex items-center gap-3">
        <img src={item.image_src} alt="todo" className="w-16 h-16 rounded-lg object-cover" onError={() => handleImgError(item.id)} />
      </div>
    )}
  </div>
))}

          </div>
        </div>
      </div>

      <ToastContainer position="top-center" autoClose={3000} />
    </>
  );
}


