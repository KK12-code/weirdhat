import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, updateDoc, doc, getDoc } from 'firebase/firestore';

// Lucide React icons (assuming they are available in the environment)
// If not, you might need to manually add them as SVG or use a CDN.
const User = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-user"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const Settings = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-settings"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.78 1.31a2 2 0 0 0 .73 2.73l.15.08a2 2 0 0 1 1 1.74v.18a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.78-1.31a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>;
const LogOut = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-log-out"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="17 16 22 12 17 8"/><line x1="22" x2="11" y1="12" y2="12"/></svg>;
const ThumbsUp = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-thumbs-up"><path d="M7 10v12c0 1.1.9 2 2 2h9c.83 0 1.5-.67 1.5-1.5 0-.27-.1-.53-.29-.73l-2-2H21c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-3l3-3H9c-1.1 0-2 .9-2 2z"/></svg>;
const ThumbsDown = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-thumbs-down"><path d="M17 14V2c0-1.1-.9-2-2-2H6c-.83 0-1.5.67-1.5 1.5 0 .27.1.53.29.73l2 2H3c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h3l-3 3h12c1.1 0 2-.9 2-2z"/></svg>;
const MessageCircle = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-message-circle"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>;
const Image = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-image"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>;
const Send = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-send"><path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/></svg>;

// Helper to get a consistent user avatar color and initial
const getUserAvatarProps = (userId) => {
    const colors = [
        'bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-red-500',
        'bg-yellow-500', 'bg-indigo-500', 'bg-pink-500', 'bg-teal-500'
    ];
    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const color = colors[hash % colors.length];
    const initial = userId ? userId.charAt(0).toUpperCase() : 'U';
    return { color, initial };
};

// Main App Component
const App = () => {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [posts, setPosts] = useState([]);
    const [newPostContent, setNewPostContent] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef(null);

    // Firebase Initialization and Authentication
    useEffect(() => {
        try {
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

            if (Object.keys(firebaseConfig).length === 0) {
                console.error("Firebase config is missing. Please ensure __firebase_config is set.");
                return;
            }

            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);

            setDb(firestoreDb);
            setAuth(firebaseAuth);

            // Sign in with custom token if available, otherwise anonymously
            const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

            if (initialAuthToken) {
                signInWithCustomToken(firebaseAuth, initialAuthToken)
                    .catch((error) => {
                        console.error("Error signing in with custom token:", error);
                        signInAnonymously(firebaseAuth)
                            .catch((anonError) => console.error("Error signing in anonymously:", anonError));
                    });
            } else {
                signInAnonymously(firebaseAuth)
                    .catch((error) => console.error("Error signing in anonymously:", error));
            }

            // Listen for auth state changes
            const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (user) => {
                if (user) {
                    setUserId(user.uid);
                    setIsAuthReady(true);
                } else {
                    setUserId(null);
                    setIsAuthReady(true); // Still ready, just not authenticated
                }
            });

            return () => unsubscribeAuth();
        } catch (error) {
            console.error("Failed to initialize Firebase:", error);
        }
    }, []);

    // Fetch posts in real-time
    useEffect(() => {
        if (!db || !isAuthReady || !userId) return;

        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const postsCollectionRef = collection(db, `artifacts/${appId}/public/data/posts`);
        const q = query(postsCollectionRef, orderBy('timestamp', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedPosts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setPosts(fetchedPosts);
        }, (error) => {
            console.error("Error fetching posts:", error);
        });

        return () => unsubscribe();
    }, [db, isAuthReady, userId]); // Depend on db, auth readiness, and userId

    // Handle clicks outside the dropdown to close it
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handlePostSubmit = async () => {
        if (!newPostContent.trim() || !db || !userId) return;

        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const postsCollectionRef = collection(db, `artifacts/${appId}/public/data/posts`);

        try {
            await addDoc(postsCollectionRef, {
                userId: userId,
                userName: `User ${userId.substring(0, 4)}`, // Simple user name
                userHandle: `@${userId.substring(0, 8)}`, // Simple user handle
                content: newPostContent,
                likes: 0,
                dislikes: 0,
                comments: 0,
                timestamp: serverTimestamp(),
                likedBy: [], // Array to store UIDs of users who liked
                dislikedBy: [] // Array to store UIDs of users who disliked
            });
            setNewPostContent('');
        } catch (e) {
            console.error("Error adding document: ", e);
        }
    };

    const handleLikeDislike = async (postId, type) => {
        if (!db || !userId) return;

        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const postRef = doc(db, `artifacts/${appId}/public/data/posts`, postId);

        try {
            const postSnap = await getDoc(postRef);
            if (!postSnap.exists()) {
                console.warn("Post does not exist:", postId);
                return;
            }
            const postData = postSnap.data();

            let updatedLikes = postData.likes || 0;
            let updatedDislikes = postData.dislikes || 0;
            let likedBy = postData.likedBy || [];
            let dislikedBy = postData.dislikedBy || [];

            const userAlreadyLiked = likedBy.includes(userId);
            const userAlreadyDisliked = dislikedBy.includes(userId);

            if (type === 'like') {
                if (userAlreadyLiked) {
                    // Unlike
                    updatedLikes--;
                    likedBy = likedBy.filter(id => id !== userId);
                } else {
                    // Like
                    updatedLikes++;
                    likedBy.push(userId);
                    if (userAlreadyDisliked) {
                        // If previously disliked, remove dislike
                        updatedDislikes--;
                        dislikedBy = dislikedBy.filter(id => id !== userId);
                    }
                }
            } else if (type === 'dislike') {
                if (userAlreadyDisliked) {
                    // Undislike
                    updatedDislikes--;
                    dislikedBy = dislikedBy.filter(id => id !== userId);
                } else {
                    // Dislike
                    updatedDislikes++;
                    dislikedBy.push(userId);
                    if (userAlreadyLiked) {
                        // If previously liked, remove like
                        updatedLikes--;
                        likedBy = likedBy.filter(id => id !== userId);
                    }
                }
            }

            await updateDoc(postRef, {
                likes: updatedLikes,
                dislikes: updatedDislikes,
                likedBy: likedBy,
                dislikedBy: dislikedBy
            });
        } catch (e) {
            console.error("Error updating like/dislike: ", e);
        }
    };


    const handleLogout = async () => {
        if (auth) {
            try {
                await signOut(auth);
                console.log("User signed out.");
                // Optionally, force a refresh or redirect to a login page
            } catch (error) {
                console.error("Error signing out:", error);
            }
        }
    };

    const MAX_CHARACTERS = 500;
    const charCount = newPostContent.length;
    const charsLeft = MAX_CHARACTERS - charCount;

    const { color: userAvatarColor, initial: userAvatarInitial } = getUserAvatarProps(userId || 'U');

    return (
        <div className="min-h-screen bg-gray-100 font-inter antialiased flex flex-col items-center">
            {/* Header */}
            <header className="w-full bg-white shadow-sm py-4 px-6 flex justify-between items-center fixed top-0 z-10 md:px-10 lg:px-20 rounded-b-lg">
                <div className="text-xl font-bold text-gray-800">Weird Hat</div>
                <div className="relative" ref={dropdownRef}>
                    <button
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-lg cursor-pointer ${userAvatarColor} shadow-md transition-all duration-200 hover:ring-2 hover:ring-offset-2 hover:ring-purple-400`}
                        onClick={() => setShowDropdown(!showDropdown)}
                    >
                        {userAvatarInitial}
                    </button>
                    {showDropdown && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl py-2 z-20 transition-all duration-200 ease-out transform origin-top-right scale-100 opacity-100">
                            <a href="#" className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md mx-2">
                                <User className="mr-2 h-5 w-5 text-gray-500" /> Profile
                            </a>
                            <a href="#" className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md mx-2">
                                <Settings className="mr-2 h-5 w-5 text-gray-500" /> Settings
                            </a>
                            <button
                                onClick={handleLogout}
                                className="flex items-center w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 rounded-md mx-2 mt-1"
                            >
                                <LogOut className="mr-2 h-5 w-5 text-red-500" /> Log out
                            </button>
                        </div>
                    )}
                </div>
            </header>

            <main className="flex-1 w-full max-w-2xl px-4 py-6 mt-20 md:px-6 lg:px-0">
                {/* Post Creation Area */}
                <div className="bg-white p-6 rounded-xl shadow-md mb-6 border border-gray-200">
                    <div className="flex items-start mb-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-semibold ${userAvatarColor} flex-shrink-0`}>
                            {userAvatarInitial}
                        </div>
                        <div className="ml-4 flex-grow">
                            <textarea
                                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none text-gray-800 placeholder-gray-400"
                                rows="3"
                                placeholder="What's on your weird mind?"
                                value={newPostContent}
                                onChange={(e) => setNewPostContent(e.target.value)}
                                maxLength={MAX_CHARACTERS}
                            ></textarea>
                            <div className="flex justify-between items-center text-sm text-gray-500 mt-2">
                                <span>{charCount} words - {charsLeft} characters left</span>
                                <div className="flex items-center space-x-3">
                                    <button className="p-2 text-gray-500 hover:text-purple-600 transition-colors duration-200 rounded-full hover:bg-gray-100">
                                        <Image className="w-5 h-5" />
                                    </button>
                                    <button
                                        className={`flex items-center px-4 py-2 rounded-full font-semibold text-white transition-all duration-300 ${newPostContent.trim().length > 0 ? 'bg-purple-600 hover:bg-purple-700 shadow-lg' : 'bg-purple-300 cursor-not-allowed'}`}
                                        onClick={handlePostSubmit}
                                        disabled={!newPostContent.trim()}
                                    >
                                        Post <Send className="ml-2 w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Post Feed */}
                <div className="space-y-4">
                    {posts.length === 0 && isAuthReady && (
                        <p className="text-center text-gray-500 py-10">No posts yet. Be the first to post!</p>
                    )}
                    {!isAuthReady && (
                        <p className="text-center text-gray-500 py-10">Loading posts...</p>
                    )}
                    {posts.map((post) => {
                        const { color: postUserAvatarColor, initial: postUserAvatarInitial } = getUserAvatarProps(post.userId);
                        const timeAgo = post.timestamp ?
                            `${Math.floor((Date.now() - post.timestamp.toDate()) / (1000 * 60 * 60))}h` : 'Now';

                        const hasLiked = post.likedBy && post.likedBy.includes(userId);
                        const hasDisliked = post.dislikedBy && post.dislikedBy.includes(userId);

                        return (
                            <div key={post.id} className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
                                <div className="flex items-start mb-4">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-semibold ${postUserAvatarColor} flex-shrink-0`}>
                                        {postUserAvatarInitial}
                                    </div>
                                    <div className="ml-4 flex-grow">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <span className="font-bold text-gray-800">{post.userName}</span>
                                                <span className="text-gray-500 text-sm ml-2">{post.userHandle}</span>
                                            </div>
                                            <span className="text-gray-500 text-sm">{timeAgo}</span>
                                        </div>
                                        <p className="mt-2 text-gray-700 leading-relaxed">{post.content}</p>
                                        <div className="flex items-center justify-between mt-4 text-gray-600 text-sm">
                                            <div className="flex space-x-4">
                                                <button
                                                    className={`flex items-center space-x-1 p-2 rounded-full transition-colors duration-200 ${hasLiked ? 'text-purple-600 bg-purple-50' : 'hover:text-purple-600 hover:bg-gray-100'}`}
                                                    onClick={() => handleLikeDislike(post.id, 'like')}
                                                >
                                                    <ThumbsUp className="w-5 h-5" />
                                                    <span>{post.likes}</span>
                                                </button>
                                                <button
                                                    className={`flex items-center space-x-1 p-2 rounded-full transition-colors duration-200 ${hasDisliked ? 'text-red-600 bg-red-50' : 'hover:text-red-600 hover:bg-gray-100'}`}
                                                    onClick={() => handleLikeDislike(post.id, 'dislike')}
                                                >
                                                    <ThumbsDown className="w-5 h-5" />
                                                    <span>{post.dislikes}</span>
                                                </button>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                                <MessageCircle className="w-5 h-5" />
                                                <span>{post.comments}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>

            {/* Display User ID for debugging/multi-user interaction */}
            {userId && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-3 py-1 rounded-full shadow-lg z-50">
                    Your User ID: {userId}
                </div>
            )}
        </div>
    );
};

export default App;
