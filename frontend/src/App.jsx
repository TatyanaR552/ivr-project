import { Navigate, Route, Routes } from "react-router-dom"

import { isAuthenticated } from "./api.js"
import Login from "./pages/Login.jsx"
import Profile from "./pages/Profile.jsx"
import Register from "./pages/Register.jsx"
import Room from "./pages/Room.jsx"
import RoomList from "./pages/RoomList.jsx"

function PrivateRoute({ children }) {
  return isAuthenticated() ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateRoute><RoomList /></PrivateRoute>} />
      <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
      <Route path="/rooms/:roomId" element={<PrivateRoute><Room /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

