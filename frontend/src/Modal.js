// src/Modal.js
import React from 'react';
import './Modal.css';

const Modal = ({ show, onClose, children }) => {
  if (!show) {
    return null;
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <span className="close" onClick={onClose}>&times;</span>
        {children}
      </div>
    </div>
  );
};

export default Modal;
