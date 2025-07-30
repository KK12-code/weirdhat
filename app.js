// Firebase SDK imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, orderBy, query, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBK97bE83_YAF4wdoWEJtDDIj7YPG823-Q",
    authDomain: "weirdhat-2d71f.firebaseapp.com",
    projectId: "weirdhat-2d71f",
    storageBucket: "weirdhat-2d71f.firebasestorage.app",
    messagingSenderId: "183250614435",
    appId: "1:183250614435:web:656707b5ef86ac12486716",
    measurementId: "G-D6P8MSFE1P"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Global posts array
let posts = [];
let unsubscribe = null;

// DOM elements
const postContent = document.getElementById('postContent');
const postButton = document.getElementById('postButton');
const charCount = document.getElementById('charCount');
const postsFeed = document.getElementById('postsFeed');
const loadingState = document.getElementById('loadingState');
const refreshButton = document.getElementById('refreshButton');

function getUserId() {
    let userId = localStorage.getItem('weirdhat_user_id');
    if (!userId) {
        userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('weirdhat_user_id', userId);
    }
    return userId;
}

// Character counter
postContent.addEventListener('input', function() {
    const currentLength = this.value.length;
    const maxLength = 280;
    charCount.textContent = `${currentLength}/${maxLength} characters`;
    postButton.disabled = !(currentLength > 0 && currentLength <= maxLength);
    if (currentLength > 250) {
        charCount.className = 'text-sm text-red-500';
    } else if (currentLength > 200) {
        charCount.className = 'text-sm text-yellow-500';
    } else {
        charCount.className = 'text-sm text-gray-500';
    }
});

// Add new post
async function addPost(content) {
    try {
        const originalText = postButton.textContent;
        postButton.textContent = 'Posting...';
        postButton.disabled = true;
        const newPost = {
            content: content.trim(),
            author: 'Anonymous',
            timestamp: serverTimestamp(),
            upvotes: 0,
            downvotes: 0,
            votes: {},
            comments: []
        };
        let postId = null;
        if (db) {
            try {
                const docRef = await addDoc(collection(db, "posts"), newPost);
                postId = docRef.id;
            } catch (firebaseError) {
                console.error("Firebase write failed:", firebaseError);
            }
        }
        const localPost = {
            id: postId || 'local_' + Date.now(),
            ...newPost,
            timestamp: new Date()
        };
        posts.unshift(localPost);
        renderPosts();
        localStorage.setItem('weirdhat_local_posts', JSON.stringify(posts));
        postContent.value = '';
        charCount.textContent = '0/280 characters';
        charCount.className = 'text-sm text-gray-500';
        postButton.disabled = true;
    } catch (error) {
        console.error("Error adding post:", error);
        alert("Failed to post. Please try again.");
    } finally {
        postButton.textContent = 'Post Anonymously';
        postButton.disabled = false;
    }
}

// Voting
async function votePost(postId, voteType) {
    try {
        const userId = getUserId();
        const post = posts.find(p => p.id === postId);
        if (!post) return;
        const currentVote = post.votes[userId] || 0;
        let newUpvotes = post.upvotes || 0;
        let newDownvotes = post.downvotes || 0;
        let newVoteValue = 0;
        if (voteType === 'up') {
            if (currentVote === 1) {
                newUpvotes--;
                newVoteValue = 0;
            } else {
                newUpvotes++;
                if (currentVote === -1) newDownvotes--;
                newVoteValue = 1;
            }
        } else if (voteType === 'down') {
            if (currentVote === -1) {
                newDownvotes--;
                newVoteValue = 0;
            } else {
                newDownvotes++;
                if (currentVote === 1) newUpvotes--;
                newVoteValue = -1;
            }
        }
        const newVotes = { ...post.votes };
        if (newVoteValue === 0) {
            delete newVotes[userId];
        } else {
            newVotes[userId] = newVoteValue;
        }
        post.upvotes = newUpvotes;
        post.downvotes = newDownvotes;
        post.votes = newVotes;
        localStorage.setItem('weirdhat_local_posts', JSON.stringify(posts));
        renderPosts();
        if (db && !postId.startsWith('local_')) {
            try {
                const postRef = doc(db, "posts", postId);
                await updateDoc(postRef, {
                    upvotes: newUpvotes,
                    downvotes: newDownvotes,
                    votes: newVotes
                });
            } catch (firebaseError) {
                console.error("Firebase vote update failed:", firebaseError);
            }
        }
    } catch (error) {
        console.error("Error voting on post:", error);
        alert("Failed to vote. Please try again.");
    }
}

// Add comment
async function addComment(postId, commentText) {
    try {
        const post = posts.find(p => p.id === postId);
        if (!post) return;
        const newComment = {
            id: Date.now().toString(),
            content: commentText.trim(),
            author: 'Anonymous',
            timestamp: new Date()
        };
        const updatedComments = [...(post.comments || []), newComment];
        post.comments = updatedComments;
        localStorage.setItem('weirdhat_local_posts', JSON.stringify(posts));
        renderPosts();
        document.getElementById(`commentInput-${postId}`).value = '';
        if (db && !postId.startsWith('local_')) {
            try {
                const postRef = doc(db, "posts", postId);
                await updateDoc(postRef, {
                    comments: updatedComments
                });
            } catch (firebaseError) {
                console.error("Firebase comment update failed:", firebaseError);
            }
        }
    } catch (error) {
        console.error("Error adding comment:", error);
        alert("Failed to add comment. Please try again.");
    }
}

function toggleComments(postId) {
    const commentSection = document.getElementById(`commentSection-${postId}`);
    const isHidden = commentSection.style.display === 'none';
    commentSection.style.display = isHidden ? 'block' : 'none';
}

function getUserVote(post) {
    const userId = getUserId();
    return post.votes[userId] || 0;
}

function formatTimestamp(timestamp) {
    if (!timestamp) return 'just now';
    const now = new Date();
    const timestampDate = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diffInMinutes = Math.floor((now - timestampDate) / (1000 * 60));
    if (diffInMinutes < 1) {
        return 'just now';
    } else if (diffInMinutes < 60) {
        return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffInMinutes < 1440) {
        const hours = Math.floor(diffInMinutes / 60);
        return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else {
        return timestampDate.toLocaleDateString() + ' ' + timestampDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function renderPosts() {
    if (posts.length === 0) {
        postsFeed.innerHTML = `
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                <div class="text-gray-400 text-6xl mb-4">🤔</div>
                <p class="text-gray-600 text-lg">No posts yet. Be the first to share something!</p>
            </div>
        `;
        return;
    }
    postsFeed.innerHTML = posts.map(post => {
        const userVote = getUserVote(post);
        const netVotes = (post.upvotes || 0) - (post.downvotes || 0);
        const comments = post.comments || [];
        return `
            <article class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200">
                <div class="flex justify-between items-start mb-4">
                    <div class="flex-1">
                        <p class="text-gray-900 text-lg leading-relaxed mb-3">${escapeHtml(post.content)}</p>
                        <div class="flex items-center space-x-4 text-sm text-gray-500">
                            <span class="font-medium">${post.author}</span>
                            <span>•</span>
                            <span>${formatTimestamp(post.timestamp)}</span>
                        </div>
                    </div>
                </div>
                <div class="flex items-center space-x-2 mb-4">
                    <button 
                        onclick="votePost('${post.id}', 'up')"
                        class="flex items-center space-x-1 px-3 py-1 rounded-lg transition-colors duration-200 ${
                            userVote === 1 
                                ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
                        </svg>
                        <span class="font-medium">${post.upvotes || 0}</span>
                    </button>
                    <span class="text-lg font-semibold text-gray-700">${netVotes}</span>
                    <button 
                        onclick="votePost('${post.id}', 'down')"
                        class="flex items-center space-x-1 px-3 py-1 rounded-lg transition-colors duration-200 ${
                            userVote === -1 
                                ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 10l5 5 5-5"></path>
                        </svg>
                        <span class="font-medium">${post.downvotes || 0}</span>
                    </button>
                </div>
                <div class="border-t border-gray-200 pt-4">
                    <button 
                        onclick="toggleComments('${post.id}')"
                        class="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                        </svg>
                        <span>${comments.length} comment${comments.length !== 1 ? 's' : ''}</span>
                    </button>
                    <div id="commentSection-${post.id}" class="mt-4 space-y-3" style="display: none;">
                        <div class="flex space-x-2">
                            <input 
                                type="text" 
                                id="commentInput-${post.id}"
                                placeholder="Add a comment..." 
                                class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                maxlength="200"
                            >
                            <button 
                                onclick="addComment('${post.id}', document.getElementById('commentInput-${post.id}').value)"
                                class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
                            >
                                Comment
                            </button>
                        </div>
                        <div class="space-y-3">
                            ${comments.map(comment => `
                                <div class="bg-gray-50 rounded-lg p-3">
                                    <div class="flex items-center space-x-2 mb-1">
                                        <span class="font-medium text-sm text-gray-700">${comment.author}</span>
                                        <span class="text-xs text-gray-500">${formatTimestamp(comment.timestamp)}</span>
                                    </div>
                                    <p class="text-gray-800 text-sm">${escapeHtml(comment.content)}</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </article>
        `;
    }).join('');
}

// Post button event listener
postButton.addEventListener('click', function() {
    const content = postContent.value.trim();
    if (content.length > 0 && content.length <= 280) {
        addPost(content);
    }
});

// Enter key to post (Shift+Enter for new line)
postContent.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const content = this.value.trim();
        if (content.length > 0 && content.length <= 280) {
            addPost(content);
        }
    }
});

document.addEventListener('keydown', function(e) {
    if (e.target && e.target.id && e.target.id.startsWith('commentInput-')) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const postId = e.target.id.replace('commentInput-', '');
            const commentText = e.target.value.trim();
            if (commentText.length > 0 && commentText.length <= 200) {
                addComment(postId, commentText);
            }
        }
    }
});

refreshButton.addEventListener('click', function() {
    if (unsubscribe) unsubscribe();
    initializeFirebaseListener();
});

function initializeFirebaseListener() {
    try {
        console.log("Setting up Firebase listener...");
        if (db) {
            const postsRef = collection(db, "posts");
            unsubscribe = onSnapshot(postsRef, (querySnapshot) => {
                const firebasePosts = [];
                querySnapshot.forEach((doc) => {
                    const postData = doc.data();
                    firebasePosts.push({
                        id: doc.id,
                        ...postData
                    });
                });
                // Sort by timestamp
                firebasePosts.sort((a, b) => {
                    const timeA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
                    const timeB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
                    return timeB - timeA;
                });
                posts = firebasePosts;
                loadingState.style.display = 'none';
                renderPosts();
            }, (error) => {
                loadingState.style.display = 'none';
                console.error("Error listening to Firebase posts:", error);
                // Fallback to localStorage if Firebase fails
                const localPosts = JSON.parse(localStorage.getItem('weirdhat_local_posts') || '[]');
                posts = localPosts;
                renderPosts();
            });
        } else {
            loadingState.style.display = 'none';
            // Fallback to localStorage if no Firebase
            const localPosts = JSON.parse(localStorage.getItem('weirdhat_local_posts') || '[]');
            posts = localPosts;
            renderPosts();
        }
    } catch (error) {
        loadingState.style.display = 'none';
        console.error("Error setting up Firebase listener:", error);
        // Fallback to localStorage if error
        const localPosts = JSON.parse(localStorage.getItem('weirdhat_local_posts') || '[]');
        posts = localPosts;
        renderPosts();
    }
}

function initializeApp() {
    initializeFirebaseListener();
}

document.addEventListener('DOMContentLoaded', initializeApp);